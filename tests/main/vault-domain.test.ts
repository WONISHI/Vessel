import { afterEach, expect, it, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { seal, unseal } from '@main/vault/crypto'

const state = vi.hoisted(() => ({ directory: '', osKey: Buffer.alloc(32, 1), handlers: new Map<string, (...args: any[]) => any>() }))
vi.mock('electron', async () => {
  const { seal, unseal } = await import('@main/vault/crypto')
  return {
    app: { getPath: () => state.directory, on: vi.fn() }, powerMonitor: { on: vi.fn() }, dialog: {},
    safeStorage: { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'keychain',
      encryptString: (value: string) => Buffer.from(JSON.stringify(seal(state.osKey, value, 'test-os-keychain'))),
      decryptString: (value: Buffer) => unseal(state.osKey, JSON.parse(value.toString()), 'test-os-keychain') }
  }
})
vi.mock('@main/vault/system-auth', () => ({ authenticatePasswordReveal: vi.fn(async () => {}) }))
import { registerVault, vaultDomains, saveGitCredential, readGitCredential } from '@main/vault/service'
import { DatabaseSyncService } from '@main/sync/database-sync/service'
import { LocalVaultStorage, RemoteVaultStorage } from '@main/vault/storage'

const directories: string[] = []
afterEach(async () => { await vaultDomains.switch(async () => {}); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })
function directory() { const path = mkdtempSync(join(tmpdir(), 'vessel-vault-domain-')); directories.push(path); return path }
function database() {
  const accounts = new Map<string, any>(), envelopes = new Map<string, any>()
  let tail = Promise.resolve(), offline = false
  const factory = () => {
    let release: (() => void) | undefined, snapshot: Map<string, any> | undefined
    return { on: vi.fn(), connect: async () => { if (offline) throw new Error('secret driver detail') }, end: async () => {}, query: async (sql: string, values: any[] = []) => {
      if (offline) throw new Error('secret driver detail')
      if (sql.startsWith('SELECT 1 FROM vessel_sync.account_initialization')) return { rows: [{}] }
      if (sql === 'BEGIN') { const previous = tail; tail = new Promise<void>(resolve => { release = resolve }); await previous; snapshot = new Map(envelopes) }
      if (sql === 'ROLLBACK' && snapshot) { envelopes.clear(); for (const [id, value] of snapshot) envelopes.set(id, value) }
      if (sql === 'COMMIT' || sql === 'ROLLBACK') { release?.(); release = undefined }
      if (sql.startsWith('INSERT INTO vessel_sync.accounts')) accounts.set(values[1], { id: values[0], name: values[1], salt: values[2], password_hash: values[3] })
      if (sql.includes('FROM vessel_sync.accounts WHERE name=$1')) return { rows: accounts.has(values[0]) ? [accounts.get(values[0])] : [] }
      if (sql.startsWith('SELECT envelope')) return { rows: envelopes.has(values[0]) ? [{ envelope: structuredClone(envelopes.get(values[0])) }] : [] }
      if (sql.startsWith('INSERT INTO vessel_vault.vaults') || sql.startsWith('UPDATE vessel_vault.vaults')) envelopes.set(values[0], JSON.parse(values[1]))
      return { rows: [] }
    } }
  }
  return { factory, envelopes, accounts, setOffline: (value: boolean) => { offline = value } }
}
it('keeps local and remote vaults isolated, imports by consent, and recovers after reinstall with a new OS keychain', async () => {
  state.directory = directory(); state.osKey = randomBytes(32)
  const firstInstall = state.directory, db = database(), frame = {}
  registerVault({ mainFrame: frame, ipc: { handle: (name: string, action: any) => state.handlers.set(name, action) }, once: vi.fn(), isDestroyed: () => false } as never)
  const request = (action: string, data = {}) => state.handlers.get('vault:request')!({ senderFrame: frame }, action, data)
  const context = { origin: 'https://private.test', username: 'local-account', password: 'local-secret' }
  await saveGitCredential(context)
  expect(existsSync(join(firstInstall, 'password-vault.sqlite'))).toBe(true)
  expect(readFileSync(join(firstInstall, 'password-vault.sqlite')).includes(Buffer.from('local-secret'))).toBe(false)
  const config = { type: 'postgresql' as const, host: 'localhost', port: 5432, database: 'test', username: 'db-owner', password: 'db-secret', sslmode: 'disable' as const, connectTimeout: 30 }
  const service = new DatabaseSyncService(firstInstall, 'first-device', async () => {}, db.factory as any, () => [], vaultDomains)
  await service.connect(config)
  await service.authenticate('register', 'alice', 'original-password')
  await service.authenticate('login', 'alice', 'original-password')
  expect(await request('status')).toMatchObject({ source: 'remote' })
  expect(await request('list')).toEqual([])
  await request('import-local')
  expect(await readGitCredential(context)).toEqual({ username: 'local-account', password: 'local-secret' })
  await saveGitCredential({ origin: 'https://remote.test', username: 'remote-account', password: 'remote-secret' })
  for (const secret of ['remote-account', 'remote-secret', 'local-secret', 'local-account', 'private.test', 'original-password', 'db-secret']) expect(JSON.stringify([...db.envelopes.values()])).not.toContain(secret)
  await service.logout()
  expect(await readGitCredential(context)).toEqual({ username: 'local-account', password: 'local-secret' })
  expect(await readGitCredential({ origin: 'https://remote.test' })).toBeUndefined()
  await service.dispose()
  // A fresh installation has neither the old files nor the old OS encryption key.
  state.directory = directory(); state.osKey = randomBytes(32)
  const fresh = new DatabaseSyncService(state.directory, 'new-device', async () => {}, db.factory as any, () => [], vaultDomains)
  await fresh.connect(config)
  await expect(fresh.authenticate('login', 'alice', 'wrong-password')).rejects.toThrow('密码不正确')
  await fresh.authenticate('login', 'alice', 'original-password')
  expect(await readGitCredential({ origin: 'https://remote.test' })).toEqual({ username: 'remote-account', password: 'remote-secret' })
  expect(existsSync(join(state.directory, 'password-vault.sqlite'))).toBe(false)
  db.setOffline(true)
  await expect(saveGitCredential({ origin: 'https://remote.test', username: 'remote-account', password: 'must-not-write-locally' })).rejects.toThrow('未回退到本地')
  expect(existsSync(join(state.directory, 'password-vault.sqlite'))).toBe(false)
  db.setOffline(false)
  await fresh.logout()
  await fresh.authenticate('register', 'bob', 'bob-password')
  await fresh.authenticate('login', 'bob', 'bob-password')
  expect(await request('list')).toEqual([])
  await fresh.dispose()
}, 60000)

it('serializes remote updates from two devices and rejects insecure remote transport', async () => {
  const db = database(), osA = randomBytes(32), osB = randomBytes(32)
  const codec = (key: Buffer) => ({ isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(JSON.stringify(seal(key, value, 'os'))), decryptString: (value: Buffer) => unseal(key, JSON.parse(value.toString()), 'os') })
  await expect(RemoteVaultStorage.unlock('alice', 'account-password', { host: 'db.example.test', ssl: false }, codec(osA), db.factory as any)).rejects.toThrow('TLS')
  const a = await RemoteVaultStorage.unlock('alice', 'account-password', { host: 'localhost' }, codec(osA), db.factory as any)
  const b = await RemoteVaultStorage.unlock('alice', 'account-password', { host: 'localhost' }, codec(osB), db.factory as any)
  await Promise.all([a, b].map((store, index) => store.run(async () => {
    const doc = (await store.read())!
    doc.records.push({ id: String(index), data: seal(randomBytes(32), 'opaque fixture', 'fixture') })
    await store.write(doc)
  })))
  await a.run(async () => { expect((await a.read())!.records).toHaveLength(2) })
  a.close(); b.close()
})

it('migrates the old encrypted file once and never resurrects deliberately removed records', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const { emptyVault } = await import('@main/vault/document')
  const root = directory(), key = randomBytes(32)
  mkdirSync(join(root, 'password-vault'))
  const doc = emptyVault(key, randomBytes(16).toString('base64'), 'test-os-wrapped')
  writeFileSync(join(root, 'password-vault/vault.json'), JSON.stringify(doc))
  const store = new LocalVaultStorage(root)
  expect(await store.read()).toEqual(doc)
  expect(existsSync(join(root, 'password-vault/vault.json'))).toBe(false)
  expect(existsSync(join(root, 'password-vault/vault.json.migrated'))).toBe(true)
  await store.write({ ...doc, records: [] }); store.close()
})
