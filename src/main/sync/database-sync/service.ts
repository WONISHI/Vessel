import { RemoteDomainData } from '../../database/remote-data'
import type { VaultDomainLifecycle, VaultStorage } from '../../vault/storage'
import { accountNeedsInitialization, initializeAccount, synchronizeLocalAccount } from './initialize-account'
import { switchDataDomain } from '../../database/data-domain'
import { Client, type ClientConfig } from 'pg'
import { randomBytes, randomUUID } from 'node:crypto'
import { hashAccountPassword, verifyAccountPassword } from './account-password'
import type { DatabaseDomain, DatabaseSyncConfig, DatabaseSyncResult, DatabaseSyncStatus } from '@vessel/type/database-sync'
import { postgresOptions, validateDatabaseSyncConfig } from './config'
import { collectLocalSequences, collectLocalTables, remoteTableName, type SyncTable } from './local-data'
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`
const SCHEMA = `
 CREATE SCHEMA IF NOT EXISTS vessel_sync;
 CREATE TABLE IF NOT EXISTS vessel_sync.accounts (id UUID PRIMARY KEY, name TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS vessel_sync.account_initialization (account_id UUID PRIMARY KEY REFERENCES vessel_sync.accounts(id), initialized_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS vessel_sync.table_catalog (account_id UUID NOT NULL REFERENCES vessel_sync.accounts(id), device_id TEXT NOT NULL, database_name TEXT NOT NULL, table_name TEXT NOT NULL, remote_table TEXT NOT NULL, columns_json JSONB NOT NULL, row_count INTEGER NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(account_id,device_id,database_name,table_name));
`
export class DatabaseSyncService {
  private disposed = false
  private client?: Client
  private config?: DatabaseSyncConfig
  private systemConfig?: DatabaseSyncConfig
  private userConfig?: DatabaseSyncConfig
  private domain: DatabaseDomain = 'system'
  private user?: { id: string; name: string }
  private lastSync?: DatabaseSyncResult
  private attempts = 0
  private attemptsSince = 0
  private pendingLogin?: { user: { id: string; name: string }; remote: RemoteDomainData; vault?: VaultStorage; initialized?: boolean }
  constructor(private directory: string, private deviceId: string, private save: (config: DatabaseSyncConfig) => Promise<void>, private clientFactory: (config: ClientConfig) => Client = config => new Client(config), private collect = collectLocalTables, private vault?: VaultDomainLifecycle) {}
  status(): DatabaseSyncStatus {
    const config = this.domain === 'user' ? this.userConfig : this.systemConfig
    return { initializationRequired: !!this.pendingLogin, systemAvailable: !!this.systemConfig, userConfigured: !!this.userConfig, domain: this.domain, source: this.user ? 'remote' : 'local', configured: !!config, connected: !!this.client, config: config ? { type: config.type, host: config.host, port: config.port, database: config.database, username: config.username, sslmode: config.sslmode, connectTimeout: config.connectTimeout } : undefined, user: this.user, lastSync: this.lastSync }
  }
  setSystemConfig(config: DatabaseSyncConfig) { this.systemConfig = validateDatabaseSyncConfig(config) }
  setSavedConfig(config: DatabaseSyncConfig) { this.userConfig = validateDatabaseSyncConfig(config); this.domain = 'user' }
  private connection() {
    if (!this.client) throw new Error('请先连接数据库')
    return this.client
  }
  private async prepareTables(client: Client, tables: SyncTable[]) {
    if (!tables.length) return
    // Send DDL and compatibility checks together instead of two round trips per table.
    const statements = tables.flatMap(table => {
      const name = identifier(remoteTableName(table.database, table.name))
      // Existing incompatible tables fail here instead of being overwritten or dropped.
      return [
        `CREATE TABLE IF NOT EXISTS vessel_sync.${name} (account_id UUID NOT NULL REFERENCES vessel_sync.accounts(id), device_id TEXT NOT NULL, row_key TEXT NOT NULL, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(account_id,device_id,row_key))`,
        `SELECT account_id,device_id,row_key,data,updated_at FROM vessel_sync.${name} LIMIT 0`
      ]
    })
    await client.query(statements.join('; '))
  }
  async connect(input?: DatabaseSyncConfig, domain?: DatabaseDomain) {
    if (this.disposed) throw new Error("同步窗口已关闭")
    const kind = input ? 'user' : domain ?? this.domain
    const selected = input ?? (kind === 'system' ? this.systemConfig : this.userConfig)
    if (!selected) throw new Error(kind === 'system' ? '系统域尚未由 Vessel 配置，请先添加用户域' : '请重新填写用户域的数据库连接配置')
    const config = validateDatabaseSyncConfig(selected)
    const candidate = this.clientFactory(postgresOptions(config))
    candidate.on('error', () => { if (this.client === candidate) { this.client = undefined } })
    let transaction = false
    try {
      await candidate.connect()
      await candidate.query('BEGIN'); transaction = true
      await candidate.query(`SELECT pg_advisory_xact_lock(736514829); ${SCHEMA} SELECT id,name,salt,password_hash FROM vessel_sync.accounts LIMIT 0`)
      await this.prepareTables(candidate, this.collect(this.directory, false))
      await candidate.query('COMMIT'); transaction = false
      if (this.disposed) throw new Error("同步窗口已关闭")
      await this.save(config)
    } catch (error) {
      if (transaction) await candidate.query('ROLLBACK').catch(() => {})
      await candidate.end().catch(() => {})
      throw error
    }
    if (this.user || this.pendingLogin) await this.logout()
    await this.client?.end().catch(() => {})
    if (this.disposed) { await candidate.end().catch(() => {}); throw new Error("同步窗口已关闭") }
    this.client = candidate; this.config = config; this.domain = kind; if (kind === 'user') this.userConfig = config; this.user = undefined; this.lastSync = undefined
    return this.status()
  }
  async authenticate(mode: 'login' | 'register', name: string, password: string) {
    if (this.pendingLogin) throw new Error('请先选择是否同步本地数据库，或断开当前连接')
    const client = this.connection()
    if (!['login', 'register'].includes(mode) || typeof name !== 'string' || !/^[\p{L}\p{N}_@.-]{2,80}$/u.test(name.trim()) || typeof password !== 'string' || password.length < 8 || password.length > 256) throw new Error('账号需为 2–80 个字母、数字或 _@.-，密码需为 8–256 个字符')
    if (Date.now() - this.attemptsSince > 300000) { this.attemptsSince = Date.now(); this.attempts = 0 }
    if (++this.attempts > 10) throw new Error('尝试次数过多，请 5 分钟后重试')
    const username = name.trim().toLowerCase()
    if (mode === 'register') {
      const salt = randomBytes(16).toString('hex')
      const hash = await hashAccountPassword(password, salt)
      try { await client.query('INSERT INTO vessel_sync.accounts(id,name,salt,password_hash) VALUES($1,$2,$3,$4)', [randomUUID(), username, salt, hash]) }
      catch (error) { if ((error as { code?: string }).code === '23505') throw new Error('该账号已注册，请直接登录'); throw error }
      return this.status()
    }
    const result = await client.query('SELECT id,name,salt,password_hash FROM vessel_sync.accounts WHERE name=$1', [username])
    const record = result.rows[0]
    // Perform the same expensive hash for an unknown account.
    const salt = record?.salt ?? '00000000000000000000000000000000'
    const verification = await verifyAccountPassword(password, salt, record?.password_hash ?? 'argon2id-v1:' + '00'.repeat(64))
    if (!record) throw new Error('未找到该账号，请先注册')
    if (!verification.valid) throw new Error('密码不正确')
    // The authentication verifier must not offer a cheaper offline guessing path than the vault KDF.
    if (verification.legacy) await client.query('UPDATE vessel_sync.accounts SET password_hash=$1 WHERE id=$2 AND password_hash=$3', [await hashAccountPassword(password, salt), record.id, record.password_hash])
    this.attempts = 0
    const needsInitialization = await accountNeedsInitialization(client, record.id)
    const remote = new RemoteDomainData(this.directory, record.id, postgresOptions(this.config!), this.clientFactory)
    const vault = await this.vault?.prepare(record.id, password, postgresOptions(this.config!), this.clientFactory)
    const hasVaultData = needsInitialization && vault ? await vault.run(async () => !!(await vault.read())?.records.length) : false
    if (needsInitialization && !hasVaultData) {
      this.pendingLogin = { user: { id: record.id, name: record.name }, remote, vault }
      return this.status()
    }
    await this.finishLogin({ user: { id: record.id, name: record.name }, remote, vault })
    return this.status()
  }
  private async finishLogin({ user, remote, vault }: NonNullable<DatabaseSyncService['pendingLogin']>) {
    try {
      if (this.vault) await this.vault.switch(() => switchDataDomain(remote), vault)
      else await switchDataDomain(remote)
    } catch (error) {
      if (this.pendingLogin?.remote !== remote) { await remote.close(); vault?.close() }
      throw error
    }
    this.user = user
  }
  async initialize(importLocal: boolean) {
    if (typeof importLocal !== 'boolean') throw new Error('请选择是否同步本地数据库')
    const pending = this.pendingLogin
    if (!pending) throw new Error('当前账号无需初始化，请重新登录')
    // Read the actual local files before publishing the remote data domain.
    if (!pending.initialized) {
      const tables = this.collect(this.directory, importLocal)
      await initializeAccount(this.connection(), pending.user.id, tables, importLocal, importLocal ? collectLocalSequences(this.directory) : {})
      pending.initialized = true
    }
    await this.finishLogin(pending)
    this.pendingLogin = undefined
    return this.status()
  }
  async logout() {
    if (this.pendingLogin) { await this.pendingLogin.remote.close(); this.pendingLogin.vault?.close(); this.pendingLogin = undefined }
    if (this.vault) await this.vault.switch(() => switchDataDomain())
    else await switchDataDomain()
    this.user = undefined
    return this.status()
  }
  async syncLocal() {
    const client = this.connection(), user = this.user
    if (!user) throw new Error('请先登录同步账号')
    const tables = this.collect(this.directory)
    if (!tables.length) throw new Error('未发现可同步的本地数据库')
    await synchronizeLocalAccount(client, user.id, tables, collectLocalSequences(this.directory))
    this.lastSync = { at: new Date().toISOString(), databases: new Set(tables.map(table => table.database)).size, tables: tables.length, rows: tables.reduce((sum, table) => sum + table.rows.length, 0) }
    return this.lastSync
  }
  async upload() {
    const client = this.connection(), user = this.user
    if (!user) throw new Error('请先注册并登录同步账号')
    const tables = this.collect(this.directory)
    if (!tables.length) throw new Error('未发现可同步的本地数据库')
    await client.query('BEGIN')
    try {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id])
      await this.prepareTables(client, tables)
      for (const table of tables) {
        const remote = remoteTableName(table.database, table.name), name = identifier(remote)
        // Reconcile the current device's complete snapshot, including rows deleted locally.
        await client.query(`DELETE FROM vessel_sync.${name} WHERE account_id=$1 AND device_id=$2`, [user.id, this.deviceId])
        for (let offset = 0; offset < table.rows.length; offset += 200) {
          const batch = table.rows.slice(offset, offset + 200)
          await client.query(`INSERT INTO vessel_sync.${name}(account_id,device_id,row_key,data) SELECT $1,$2,x.key,x.value::jsonb FROM jsonb_to_recordset($3::jsonb) AS x(key text,value text) ON CONFLICT(account_id,device_id,row_key) DO UPDATE SET data=excluded.data,updated_at=now()`, [user.id, this.deviceId, JSON.stringify(batch)])
        }
        await client.query(`INSERT INTO vessel_sync.table_catalog(account_id,device_id,database_name,table_name,remote_table,columns_json,row_count) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT(account_id,device_id,database_name,table_name) DO UPDATE SET remote_table=excluded.remote_table,columns_json=excluded.columns_json,row_count=excluded.row_count,updated_at=now()`, [user.id, this.deviceId, table.database, table.name, remote, JSON.stringify(table.schema), table.rows.length])
      }
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error }
    this.lastSync = { at: new Date().toISOString(), databases: new Set(tables.map(table => table.database)).size, tables: tables.length, rows: tables.reduce((sum, table) => sum + table.rows.length, 0) }
    return this.lastSync
  }
  async deleteRemoteData() {
    const client = this.connection(), user = this.user
    if (!user) throw new Error('请先在数据库同步中登录账号，再删除远程数据')
    await client.query('BEGIN')
    try {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id])
      const { rows } = await client.query('SELECT DISTINCT remote_table FROM vessel_sync.table_catalog WHERE account_id=$1', [user.id])
      for (const { remote_table: table } of rows) {
        if (typeof table !== 'string' || !/^[a-zA-Z0-9_]{1,63}$/.test(table)) throw new Error('远程表目录异常，已取消删除')
        await client.query(`DELETE FROM vessel_sync.${identifier(table)} WHERE account_id=$1`, [user.id])
      }
      await client.query('DELETE FROM vessel_sync.table_catalog WHERE account_id=$1', [user.id])
      const vault = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='vessel_vault' AND table_name='vaults'")
      if (vault.rows.length) await client.query('DELETE FROM vessel_vault.vaults WHERE account_id=$1', [user.id])
      const live = await client.query("SELECT table_name FROM information_schema.columns WHERE table_schema='vessel_data' AND column_name='account_id'")
      for (const { table_name: table } of live.rows) {
        if (typeof table !== 'string' || !/^[a-zA-Z0-9_]{1,63}$/.test(table)) throw new Error('远程表名称异常，已取消删除')
        await client.query(`DELETE FROM vessel_data.${identifier(table)} WHERE account_id=$1`, [user.id])
      }
      await client.query('COMMIT')
      this.lastSync = undefined
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error }
  }
  async dispose() { this.disposed = true; await this.disconnect() }
  async disconnect() { await this.logout(); const client = this.client; this.client = undefined; await client?.end().catch(() => {}); return this.status() }
}
