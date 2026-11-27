import Database from 'better-sqlite3'
import { Client, type ClientConfig } from 'pg'
import { join, resolve } from 'node:path'
import { domainConnection, inRemoteMemory, type RemoteDataBackend } from './data-domain'
import { encodeSyncRow, remoteTableName } from '../sync/database-sync/local-data'
import { STORAGE_DATABASES } from './storage-browser'
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
type Cell = { type: string; value: string | number | null }
const decode = (row: Record<string, Cell>) => Object.fromEntries(Object.entries(row).map(([key, cell]) => [key,
  cell.type === 'blob' ? Buffer.from(String(cell.value), 'base64') : cell.type === 'integer' ? BigInt(String(cell.value)) : cell.value
]))

/** PostgreSQL is authoritative. SQLite is a short-lived, in-memory SQL compatibility layer only. */
export class RemoteDomainData implements RemoteDataBackend {
  private closed = false
  private prepared = new Set<string>()
  private client?: Client
  private queue = Promise.resolve()
  private stateReads = new Map<string, Promise<unknown>>()
  constructor(private directory: string, private accountId: string, private options: ClientConfig, private factory: (options: ClientConfig) => Client = options => new Client(options)) {}
  async run<T>(names: string[], action: () => T | Promise<T>): Promise<T> {
    if (this.closed) throw new Error('远程数据域已关闭，请重新登录')
    const databases = [...new Set(names)].sort()
    for (const name of databases) if (!(STORAGE_DATABASES as readonly string[]).includes(name)) throw new Error('不支持的数据域数据库')
    return this.withClient(client => this.runTransaction(client, databases, action))
  }
  /** Reuse one authenticated TLS connection; serialize transactions so callers never share a transaction. */
  private async withClient<T>(action: (client: Client) => Promise<T>): Promise<T> {
    const previous = this.queue
    let release!: () => void
    this.queue = new Promise<void>(resolve => { release = resolve })
    await previous
    try {
      if (this.closed) throw new Error('远程数据域已关闭，请重新登录')
      if (!this.client) {
        const client = this.factory(this.options)
        client.on('error', () => {
          if (this.client === client) this.client = undefined
          void client.end().catch(() => {})
        })
        this.client = client
        await client.connect()
      }
      return await action(this.client)
    } catch {
      const client = this.client
      this.client = undefined
      await client?.end().catch(() => {})
      throw new Error('远程数据库操作失败，请检查连接后重试；本次修改未写入本地')
    } finally { release() }
  }
  /** Fetch a single JSON setting without rebuilding SQLite or downloading unrelated tables. */
  readState(key: string): Promise<unknown> {
    const pending = this.stateReads.get(key)
    if (pending) return pending
    const operation = this.withClient(async client => {
      const table = quote(remoteTableName('vessel.db', 'app_state'))
      const query = () => client.query(`SELECT data->'value_json'->>'value' AS value_json FROM vessel_data.${table} WHERE account_id=$1 AND data->'key'->>'value'=$2 LIMIT 1`, [this.accountId, key])
      let result
      try { result = await query() }
      catch (error) {
        if ((error as { code?: string }).code !== '42P01') throw error
        await client.query(`CREATE SCHEMA IF NOT EXISTS vessel_data; CREATE TABLE IF NOT EXISTS vessel_data.${table} (account_id UUID NOT NULL REFERENCES vessel_sync.accounts(id), row_key BIGINT NOT NULL, data JSONB NOT NULL, PRIMARY KEY(account_id,row_key))`)
        result = await query()
      }
      const value = result.rows[0]?.value_json
      return value == null ? null : JSON.parse(value)
    })
    this.stateReads.set(key, operation)
    void operation.finally(() => { if (this.stateReads.get(key) === operation) this.stateReads.delete(key) }).catch(() => {})
    return operation
  }
  private async runTransaction<T>(client: Client, databases: string[], action: () => T | Promise<T>): Promise<T> {
    const memory = new Map<string, Database.Database>()
    let transaction = false
    let fetchedBytes = 0
    const baselines = new Map<string, string>()
    const sequenceBaselines = new Map<string, string>()
    try {
      await client.query('BEGIN'); transaction = true
      await client.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [this.accountId])
      const prepare = databases.some(name => !this.prepared.has(name))
      if (prepare) {
        await client.query('SELECT pg_advisory_xact_lock(736514831); CREATE SCHEMA IF NOT EXISTS vessel_data; CREATE TABLE IF NOT EXISTS vessel_data.sequences (account_id UUID NOT NULL REFERENCES vessel_sync.accounts(id), database_name TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY(account_id,database_name))')
      }
      for (const name of databases) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${this.accountId}/${name}`])
        const path = resolve(join(this.directory, name)), local = domainConnection(path)
        if (!local?.open) throw new Error(`数据库 ${name} 尚未初始化`)
        const db = new Database(':memory:')
        db.pragma('foreign_keys = OFF')
        memory.set(path, db)
        const definitions = local.prepare("SELECT name,sql,type FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name").all() as { name: string; sql: string; type: string }[]
        for (const definition of definitions) db.exec(definition.sql)
        db.pragma(`user_version = ${Number(local.pragma("user_version", { simple: true }))}`)
        const tables = definitions.filter(definition => definition.type === 'table')
        if (prepare && tables.length) await client.query(tables.map(({ name: table }) => `CREATE TABLE IF NOT EXISTS vessel_data.${quote(remoteTableName(name, table))} (account_id UUID NOT NULL REFERENCES vessel_sync.accounts(id), row_key BIGINT NOT NULL, data JSONB NOT NULL, PRIMARY KEY(account_id,row_key))`).join('; '))
        const branches = tables.map(({ name: table }, index) => `SELECT ${index}::int AS table_index,row_key,data FROM vessel_data.${quote(remoteTableName(name, table))} WHERE account_id=$1`)
        branches.push('SELECT -1::int AS table_index,0::bigint AS row_key,data FROM vessel_data.sequences WHERE account_id=$1 AND database_name=$2')
        const fetched = await client.query(branches.join(' UNION ALL ') + ' ORDER BY table_index,row_key', [this.accountId, name])
        const grouped = new Map<number, unknown[]>()
        for (const { table_index: index, data } of fetched.rows) {
          fetchedBytes += Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data))
          if (fetchedBytes > 256 * 1024 * 1024) throw new Error('远程数据超过当前可处理的大小')
          const rows = grouped.get(index) ?? []
          rows.push(typeof data === 'string' ? JSON.parse(data) : data)
          grouped.set(index, rows)
        }
        for (const [index, { name: table }] of tables.entries()) {
          for (const data of grouped.get(index) ?? []) {
            this.insert(db, table, decode(data as Record<string, Cell>))
          }
          baselines.set(`${path}/${table}`, JSON.stringify((db.prepare(`SELECT * FROM ${quote(table)}`).safeIntegers(true).all() as Record<string, unknown>[]).map(encodeSyncRow)))
        }
        if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").get()) {
          db.exec('DELETE FROM sqlite_sequence')
          for (const row of (grouped.get(-1)?.[0] ?? []) as Record<string, Cell>[]) this.insert(db, 'sqlite_sequence', decode(row))
        }
        sequenceBaselines.set(path, JSON.stringify(this.sequences(db)))
        // Preserve this running process's device/session identity, without importing local business data.
        if (name === 'vessel.db') {
          const metadata = local.prepare("SELECT * FROM app_metadata WHERE key='device.id'").get() as Record<string, unknown> | undefined
          const id = metadata?.value
          if (metadata) this.insert(db, 'app_metadata', metadata, true)
          if (id) {
            const device = local.prepare('SELECT * FROM devices WHERE id=?').get(id) as Record<string, unknown> | undefined
            if (device) this.insert(db, 'devices', device, true)
            for (const session of local.prepare('SELECT * FROM app_sessions WHERE device_id=? AND ended_at IS NULL').all(id) as Record<string, unknown>[]) this.insert(db, 'app_sessions', session, true)
          }
        }
        db.pragma('foreign_keys = ON')
      }
      const result = await inRemoteMemory(memory, action)
      let totalBytes = 0
      for (const [path, db] of memory) {
        const name = databases.find(value => resolve(join(this.directory, value)) === path)!
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]
        for (const { name: table } of tables) {
          const encoded = (db.prepare(`SELECT * FROM ${quote(table)}`).safeIntegers(true).all() as Record<string, unknown>[]).map(encodeSyncRow)
          if (JSON.stringify(encoded) === baselines.get(`${path}/${table}`)) continue
          const remote = quote(remoteTableName(name, table)), batch: { key: string; value: string }[] = []
          await client.query(`DELETE FROM vessel_data.${remote} WHERE account_id=$1`, [this.accountId])
          let index = 0
          const flush = async () => {
            if (!batch.length) return
            await client.query(`INSERT INTO vessel_data.${remote}(account_id,row_key,data) SELECT $1,x.key::bigint,x.value::jsonb FROM jsonb_to_recordset($2::jsonb) AS x(key text,value text)`, [this.accountId, JSON.stringify(batch)])
            batch.length = 0
          }
          for (const value of encoded) {
            totalBytes += Buffer.byteLength(value)
            if (totalBytes > 256 * 1024 * 1024) throw new Error('远程数据操作超过 256 MB，未保存本次修改')
            batch.push({ key: String(index++), value })
            if (batch.length === 200) await flush()
          }
          await flush()
        }
        const sequenceRows = JSON.stringify(this.sequences(db))
        if (sequenceRows !== sequenceBaselines.get(path)) await client.query('INSERT INTO vessel_data.sequences(account_id,database_name,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(account_id,database_name) DO UPDATE SET data=excluded.data', [this.accountId, name, sequenceRows])
      }
      await client.query('COMMIT'); transaction = false
      for (const name of databases) this.prepared.add(name)
      return result
    } catch {
      if (transaction) await client.query('ROLLBACK').catch(() => {})
      throw new Error('远程数据库操作失败，请检查连接后重试；本次修改未写入本地')
    } finally {
      for (const db of memory.values()) db.close()
    }
  }
  private insert(db: Database.Database, table: string, row: Record<string, unknown>, ignore = false) {
    const keys = Object.keys(row)
    if (!keys.length) return
    db.prepare(`INSERT ${ignore ? 'OR IGNORE ' : ''}INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(key => row[key]) as (string | number | bigint | Buffer | null)[])
  }
  private sequences(db: Database.Database) {
    return db.prepare("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").get()
      ? (db.prepare('SELECT * FROM sqlite_sequence').safeIntegers(true).all() as Record<string, unknown>[]).map(row => JSON.parse(encodeSyncRow(row))) : []
  }
  async close() { this.closed = true; await this.queue; const client = this.client; this.client = undefined; await client?.end().catch(() => {}) }
}
