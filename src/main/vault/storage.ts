import Database from 'better-sqlite3'
import { chmod, mkdir, readFile, rename, stat } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { Client, type ClientConfig } from 'pg'
import { salt } from './crypto'
import { emptyVault, MAX_VAULT_BYTES, validateVaultDocument, type VaultDocument } from './document'
import { sealLoginDocument, unsealLoginDocument, unwrapLoginKey, validateEnvelope, wrapLoginKey, type LoginVaultEnvelope } from './login-crypto'

export interface VaultStorage {
  readonly remote: boolean
  run<T>(action: () => Promise<T>): Promise<T>
  read(): Promise<VaultDocument | undefined>
  write(doc: VaultDocument): Promise<void>
  close(): void
}
export interface VaultDomainLifecycle {
  prepare(account: string, password: string, options: ClientConfig, factory: (options: ClientConfig) => Client): Promise<VaultStorage>
  switch(change: () => Promise<void>, next?: VaultStorage): Promise<void>
}
export type VaultKeychain = { isEncryptionAvailable(): boolean; getSelectedStorageBackend?(): string; encryptString(value: string): Buffer; decryptString(value: Buffer): string }
export function requireVaultKeychain(codec: VaultKeychain) {
  if (!codec.isEncryptionAvailable() || (process.platform === 'linux' && codec.getSelectedStorageBackend?.() === 'basic_text')) throw new Error('系统安全密钥存储不可用，已拒绝保存密码')
}
const wrapOS = (key: Buffer, codec: VaultKeychain) => {
  requireVaultKeychain(codec)
  return codec.encryptString(JSON.stringify({ auto: true, key: key.toString('base64') }))
}

/** This database contains OS-protected ciphertext only and is deliberately NOT a generic business-data sync source. */
export class LocalVaultStorage implements VaultStorage {
  readonly remote = false
  private db?: Database.Database
  constructor(private directory: string) {}
  async run<T>(action: () => Promise<T>) { return action() }
  private async open() {
    if (this.db) return this.db
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const filename = join(this.directory, 'password-vault.sqlite')
    const db = new Database(filename)
    try {
      await chmod(filename, 0o600)
      db.pragma('secure_delete = ON')
      db.exec('CREATE TABLE IF NOT EXISTS vault_document (id INTEGER PRIMARY KEY CHECK(id=1), ciphertext TEXT NOT NULL)')
      if (!db.prepare('SELECT 1 FROM vault_document WHERE id=1').get()) {
        const legacy = join(this.directory, 'password-vault', 'vault.json')
        let doc: VaultDocument | undefined
        try {
          if ((await stat(legacy)).size > MAX_VAULT_BYTES) throw new Error('保险库文件过大')
          doc = validateVaultDocument(JSON.parse(await readFile(legacy, 'utf8')))
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
        if (doc) {
          db.prepare('INSERT INTO vault_document(id,ciphertext) VALUES(1,?)').run(JSON.stringify(doc))
          // Keep a recoverable encrypted backup; never import it again after a deliberate deletion.
          await rename(legacy, legacy + '.migrated')
        }
      }
      this.db = db
      return db
    } catch (error) { db.close(); throw error }
  }
  async read() {
    const row = (await this.open()).prepare('SELECT ciphertext FROM vault_document WHERE id=1').get() as { ciphertext: string } | undefined
    return row ? validateVaultDocument(JSON.parse(row.ciphertext)) : undefined
  }
  async write(doc: VaultDocument) {
    validateVaultDocument(doc)
    const db = await this.open()
    db.prepare('INSERT INTO vault_document(id,ciphertext) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET ciphertext=excluded.ciphertext').run(JSON.stringify(doc))
  }
  close() { this.db?.close(); this.db = undefined }
}

/** A per-account transaction serializes reads and writes across devices, so a stale document cannot erase newer passwords. */
export class RemoteVaultStorage implements VaultStorage {
  readonly remote = true
  private transaction?: Client
  private current?: LoginVaultEnvelope
  private osWrapped: Buffer = Buffer.alloc(0)
  private closed = false
  private prepared = false
  private constructor(private account: string, private options: ClientConfig, private codec: VaultKeychain, private factory: (options: ClientConfig) => Client) {}
  static async unlock(account: string, password: string, options: ClientConfig, codec: VaultKeychain, factory: (options: ClientConfig) => Client = options => new Client(options)) {
    requireVaultKeychain(codec)
    const host = String(options.host ?? 'localhost')
    if (!options.ssl && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('密码同步要求启用并验证 TLS；只有本机开发数据库可使用非加密连接')
    const secure = { ...options, ssl: options.ssl ? { ...(typeof options.ssl === 'object' ? options.ssl : {}), rejectUnauthorized: true } : false }
    const store = new RemoteVaultStorage(account, secure, codec, factory)
    try {
      await store.run(async () => {
        const result = await store.transaction!.query('SELECT envelope FROM vessel_vault.vaults WHERE account_id=$1', [account])
        const envelope = result.rows[0]?.envelope
        const key = envelope ? await unwrapLoginKey(password, account, envelope) : randomBytes(32)
        try {
          store.osWrapped = wrapOS(key, codec)
          if (envelope) { store.current = validateEnvelope(envelope); unsealLoginDocument(store.current, key, account, store.osWrapped.toString('base64')) }
          else {
            const doc = emptyVault(key, salt(), store.osWrapped.toString('base64'))
            store.current = sealLoginDocument(await wrapLoginKey(password, account, key), key, account, doc)
            await store.transaction!.query('INSERT INTO vessel_vault.vaults(account_id,envelope) VALUES($1,$2::jsonb)', [account, JSON.stringify(store.current)])
          }
        } finally { key.fill(0) }
      })
      return store
    } catch { store.close(); throw new Error('无法安全解锁远程保险库，请检查原登录密码、数据库连接及 TLS 证书；原数据未被覆盖') }
  }
  async run<T>(action: () => Promise<T>): Promise<T> {
    if (this.closed || this.transaction) throw new Error('保险库状态无效，请重新登录')
    const client = this.factory(this.options)
    client.on('error', () => {})
    let began = false
    try {
      await client.connect()
      await client.query('BEGIN'); began = true
      await client.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [this.account])
      if (!this.prepared) {
        await client.query('SELECT pg_advisory_xact_lock(736514832); CREATE SCHEMA IF NOT EXISTS vessel_vault; CREATE TABLE IF NOT EXISTS vessel_vault.vaults (account_id UUID PRIMARY KEY REFERENCES vessel_sync.accounts(id), envelope JSONB NOT NULL)')
      }
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`vessel-vault/${this.account}`])
      this.transaction = client
      const result = await action()
      await client.query('COMMIT'); began = false
      this.prepared = true
      return result
    } catch {
      if (began) await client.query('ROLLBACK').catch(() => {})
      // Never leak driver messages, connection strings, or plaintext from callbacks.
      throw new Error('保险库操作失败，请检查连接或重新登录；未回退到本地保存')
    } finally { this.transaction = undefined; await client.end().catch(() => {}) }
  }
  private withKey<T>(action: (key: Buffer) => T): T {
    requireVaultKeychain(this.codec)
    const value = JSON.parse(this.codec.decryptString(this.osWrapped))
    const key = Buffer.from(value.key, 'base64')
    try { if (key.length !== 32) throw new Error(); return action(key) }
    finally { key.fill(0) }
  }
  async read() {
    if (!this.transaction) throw new Error('保险库事务无效')
    const result = await this.transaction.query('SELECT envelope FROM vessel_vault.vaults WHERE account_id=$1', [this.account])
    const next = validateEnvelope(result.rows[0]?.envelope)
    const identity = (item: LoginVaultEnvelope) => JSON.stringify([item.salt, item.wrappedKey.nonce, item.wrappedKey.ciphertext, item.wrappedKey.tag])
    if (this.current && identity(next) !== identity(this.current)) throw new Error('保险库密钥已变化，请重新登录')
    const doc = this.withKey(key => unsealLoginDocument(next, key, this.account, this.osWrapped.toString('base64')))
    this.current = next
    return doc
  }
  async write(doc: VaultDocument) {
    if (!this.transaction || !this.current) throw new Error('保险库事务无效')
    const next = this.withKey(key => sealLoginDocument(this.current!, key, this.account, doc))
    await this.transaction.query('UPDATE vessel_vault.vaults SET envelope=$2::jsonb WHERE account_id=$1', [this.account, JSON.stringify(next)])
    this.current = next
  }
  close() { this.closed = true; this.osWrapped.fill(0); this.current = undefined }
}
