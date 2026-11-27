import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { collectLocalTables, encodeSyncRow, remoteTableName } from '../../src/main/sync/database-sync/local-data'
import { validateDatabaseSyncConfig, postgresOptions } from '../../src/main/sync/database-sync/config'
import { DatabaseSyncService } from '../../src/main/sync/database-sync/service'
const paths: string[] = []
afterEach(() => { for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true }) })
const config = { type: 'postgresql' as const, host: 'localhost', port: 5432, database: 'fixture', username: 'owner', password: 'db-only-secret', sslmode: 'require' as const, connectTimeout: 30 }
it('validates PostgreSQL settings and maps TLS/timeouts without connection-string interpolation', () => {
  expect(postgresOptions(validateDatabaseSyncConfig(config))).toMatchObject({ connectionTimeoutMillis: 30000, ssl: { rejectUnauthorized: false }, password: 'db-only-secret' })
  expect(postgresOptions({ ...config, sslmode: 'verify-full' }).ssl).toEqual({ rejectUnauthorized: true })
  expect(() => validateDatabaseSyncConfig({ ...config, port: 0 })).toThrow()
  expect(() => validateDatabaseSyncConfig({ ...config, host: 'host/path' })).toThrow()
  expect(() => validateDatabaseSyncConfig({ ...config, type: 'mysql' })).toThrow()
})

it.each([true, false])('asks before initializing an empty account and seeds live data only when consent is %s', async importLocal => {
  const { service, client } = fixture(false)
  await service.connect(config)
  await service.authenticate('register', 'Alice', 'account-password')
  const status = await service.authenticate('login', 'Alice', 'account-password')
  expect(status).toMatchObject({ initializationRequired: true, source: 'local' })
  expect(status.user).toBeUndefined()
  client.query.mockClear()
  const result = await service.initialize(importLocal)
  expect(result).toMatchObject({ initializationRequired: false, source: 'remote', user: { name: 'alice' } })
  const statements = client.query.mock.calls.map(([sql]) => sql)
  expect(statements.some(sql => sql.startsWith('CREATE TABLE IF NOT EXISTS vessel_data."'))).toBe(true)
  expect(statements.some(sql => sql.startsWith('INSERT INTO vessel_data."'))).toBe(importLocal)
  expect(statements.some(sql => sql.startsWith('INSERT INTO vessel_sync.account_initialization'))).toBe(true)
  expect(statements).not.toContain(expect.stringMatching(/^DELETE/))
  await service.dispose()
}, 60000)
it('collects only allowlisted SQLite databases, keeps 64-bit integers/BLOBs and leaves source unchanged', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vessel-sync-')); paths.push(directory)
  const db = new Database(join(directory, 'vessel.db'))
  db.exec('CREATE TABLE records(id INTEGER, image BLOB, label TEXT); INSERT INTO records VALUES(9223372036854775807, x\'0102ff\', \'{"type":"blob"}\')')
  const ignored = new Database(join(directory, 'secret.sqlite')); ignored.exec('CREATE TABLE hidden(value TEXT)'); ignored.close()
  const tables = collectLocalTables(directory)
  expect(tables).toHaveLength(1)
  expect(JSON.parse(tables[0].rows[0].value)).toEqual({ id: { type: 'integer', value: '9223372036854775807' }, image: { type: 'blob', value: 'AQL/' }, label: { type: 'string', value: '{"type":"blob"}' } })
  expect(db.prepare('SELECT count(*) AS n FROM records').get()).toEqual({ n: 1 }); db.close()
  expect(encodeSyncRow({ empty: null })).toBe('{"empty":{"type":"null","value":null}}')
  expect(remoteTableName('vessel.db', 'odd"table')).toMatch(/^[a-zA-Z0-9_]{1,63}$/)
  expect(remoteTableName('vessel.db', 'a')).not.toBe(remoteTableName('todos.sqlite', 'a'))
})
function fixture(initialized = true) {
  let account: any
  const client = { connect: vi.fn(), end: vi.fn().mockResolvedValue(undefined), on: vi.fn(), query: vi.fn(async (sql: string, values?: any[]) => {
    if (sql.startsWith('SELECT 1 FROM vessel_sync.account_initialization')) return { rows: initialized ? [{}] : [] }
    if (sql.startsWith('INSERT INTO vessel_sync.accounts')) account = { id: values![0], name: values![1], salt: values![2], password_hash: values![3] }
    return { rows: sql.includes('WHERE name=$1') && account?.name === values?.[0] ? [account] : [] }
  }) }
  const save = vi.fn().mockResolvedValue(undefined)
  const tables = [{ database: 'vessel.db', name: 'app_state', schema: [], rows: [{ key: '0', value: encodeSyncRow({ key: 'theme', value: 'dark' }) }] }]
  const service = new DatabaseSyncService('/fixture', 'device-one', save, () => client as any, () => tables)
  return { client, service, save, tables }
}
it('prepares corresponding tables, hides database password and requires separate account registration/login', async () => {
  const { client, service, save } = fixture()
  expect((await service.connect(config)).config).not.toHaveProperty('password')
  expect(save).toHaveBeenCalledWith(config)
  expect(client.query.mock.calls.some(([sql]) => sql.includes('CREATE TABLE IF NOT EXISTS vessel_sync."vessel_db_app_state'))).toBe(true)
  await expect(service.upload()).rejects.toThrow('请先注册并登录')
  await expect(service.authenticate('login', 'missing-user', 'account-password')).rejects.toThrow('未找到该账号，请先注册')
  expect(service.status().user).toBeUndefined()
  expect(service.status().initializationRequired).toBe(false)
  await service.authenticate('register', 'Alice', 'account-password')
  expect(service.status().user).toBeUndefined()
  await expect(service.authenticate('login', 'Alice', 'wrong-password')).rejects.toThrow('密码不正确')
  await service.authenticate('login', 'Alice', 'account-password')
  expect(service.status().user?.name).toBe('alice')
  client.query.mockClear()
  expect(await service.upload()).toMatchObject({ databases: 1, tables: 1, rows: 1 })
  const deletion = client.query.mock.calls.find(([sql]) => sql.startsWith('DELETE FROM'))!
  expect(deletion[0]).toContain('WHERE account_id=$1 AND device_id=$2')
  expect(deletion[1]?.[1]).toBe('device-one')
  expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
  await service.logout(); await expect(service.upload()).rejects.toThrow('请先注册并登录')
}, 60000)
it('rolls back a failed upload and does not record a successful sync', async () => {
  const { service, client } = fixture()
  await service.connect(config); await service.authenticate('register', 'Alice', 'account-password'); await service.authenticate('login', 'Alice', 'account-password')
  const query = client.query.getMockImplementation()!
  client.query.mockImplementation(async (sql, values) => { if (sql.startsWith('INSERT INTO vessel_sync."')) throw new Error('fixture write failure'); return query(sql, values) })
  await expect(service.upload()).rejects.toThrow('fixture write failure')
  expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
  expect(service.status().lastSync).toBeUndefined()
  await service.dispose()
}, 60000)

it('forgets user-domain configuration in a fresh process/service and distinguishes the built-in system domain', async () => {
  const { service } = fixture()
  await service.connect(config)
  expect(service.status()).toMatchObject({ domain: 'user', userConfigured: true, source: 'local' })
  await service.dispose()
  const fresh = fixture().service
  expect(fresh.status()).toMatchObject({ domain: 'system', configured: false, userConfigured: false })
  await expect(fresh.connect()).rejects.toThrow('系统域尚未')
  fresh.setSystemConfig(config)
  await fresh.connect(undefined, 'system')
  expect(fresh.status()).toMatchObject({ domain: 'system', systemAvailable: true, userConfigured: false, configured: true })
  await fresh.dispose()
})

it('prepares and validates sixteen tables in one request while keeping the connection transaction atomic', async () => {
  const { service, client, tables } = fixture()
  for (let index = 1; index < 16; index++) tables.push({ ...tables[0], name: `table_${index}` })
  try {
    await service.connect(config)
    const statements = client.query.mock.calls.map(([sql]) => sql)
    const preparation = statements.filter(sql => sql.includes('CREATE TABLE IF NOT EXISTS vessel_sync."'))
    expect(preparation).toHaveLength(1)
    expect(preparation[0].match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(16)
    expect(preparation[0].match(/SELECT account_id,device_id,row_key,data,updated_at/g)).toHaveLength(16)
    expect(statements).toHaveLength(4)
    expect(statements[0]).toBe('BEGIN')
    expect(statements.at(-1)).toBe('COMMIT')
  } finally { await service.dispose() }
})

it('rolls back connection setup if a batched table compatibility check fails', async () => {
  const { service, client, save } = fixture()
  const query = client.query.getMockImplementation()!
  client.query.mockImplementation(async (sql, values) => {
    if (sql.includes('SELECT account_id,device_id,row_key,data,updated_at')) throw new Error('incompatible table')
    return query(sql, values)
  })
  await expect(service.connect(config)).rejects.toThrow('incompatible table')
  expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
  expect(client.end).toHaveBeenCalledOnce()
  expect(save).not.toHaveBeenCalled()
  expect(service.status().connected).toBe(false)
  await service.dispose()
})

it('synchronizes the actual local snapshot to the logged-in account live tables', async () => {
  const { service, client } = fixture()
  await service.connect(config)
  await expect(service.syncLocal()).rejects.toThrow('请先登录')
  await service.authenticate('register', 'Alice', 'account-password')
  await service.authenticate('login', 'Alice', 'account-password')
  client.query.mockClear()
  const result = await service.syncLocal()
  expect(result).toMatchObject({ databases: 1, tables: 1, rows: 1 })
  expect(client.query.mock.calls.some(([sql]) => sql.startsWith('WITH cleared_0 AS (DELETE FROM vessel_data.'))).toBe(true)
  expect(client.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO vessel_data."'))).toBe(true)
  expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
  expect(service.status().lastSync).toEqual(result)
  await service.dispose()
})

it('rolls back live synchronization failures without marking synchronization successful', async () => {
  const { service, client } = fixture()
  await service.connect(config)
  await service.authenticate('register', 'Alice', 'account-password')
  await service.authenticate('login', 'Alice', 'account-password')
  const query = client.query.getMockImplementation()!
  client.query.mockImplementation(async (sql, values) => {
    if (sql.startsWith('INSERT INTO vessel_data."')) throw new Error('sync failed')
    return query(sql, values)
  })
  await expect(service.syncLocal()).rejects.toThrow('sync failed')
  expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
  expect(service.status().lastSync).toBeUndefined()
  await service.dispose()
})
