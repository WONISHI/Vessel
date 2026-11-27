import { expect, it, vi } from 'vitest'
import { accountNeedsInitialization, initializeAccount } from '@main/sync/database-sync/initialize-account'
import { encodeSyncRow } from '@main/sync/database-sync/local-data'

function database(hasRows = false) {
  const query = vi.fn(async (sql: string, args?: unknown[]) => {
    if (sql.includes('information_schema.columns')) return { rows: [{ table_name: 'other_table' }] }
    if (sql.startsWith('SELECT 1 WHERE EXISTS')) return { rows: hasRows && args?.[0] === 'alice' ? [{}] : [] }
    return { rows: [] }
  })
  return { query }
}

it('checks rows for the authenticated account, independently of other users and physical table existence', async () => {
  const client = database(true)
  expect(await accountNeedsInitialization(client as never, 'alice')).toBe(false)
  expect(await accountNeedsInitialization(client as never, 'bob')).toBe(true)
})

it('checks all live tables in one parameterized request and excludes sequence metadata', async () => {
  const client = database()
  const query = client.query.getMockImplementation()!
  client.query.mockImplementation(async (sql, args) => {
    if (sql.includes('information_schema.columns')) return { rows: ['first', 'quoted"table', 'sequences'].map(table_name => ({ table_name })) } as any
    return query(sql, args)
  })
  expect(await accountNeedsInitialization(client as never, 'bob')).toBe(true)
  const checks = client.query.mock.calls.filter(([sql]) => sql.startsWith('SELECT 1 WHERE EXISTS'))
  expect(checks).toHaveLength(1)
  expect(checks[0]).toEqual(['SELECT 1 WHERE EXISTS (SELECT 1 FROM vessel_data."first" WHERE account_id=$1) OR EXISTS (SELECT 1 FROM vessel_data."quoted""table" WHERE account_id=$1)', ['bob']])
})

it('rechecks emptiness under an account lock and refuses to overwrite concurrent remote writes', async () => {
  const client = database(true)
  await expect(initializeAccount(client as never, 'alice', [], true)).rejects.toThrow('未覆盖远程数据')
  expect(client.query.mock.calls[1]).toEqual(['SELECT pg_advisory_xact_lock(hashtext($1))', ['alice']])
  expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
  expect(client.query.mock.calls.some(([sql]) => sql.startsWith('INSERT') || sql.startsWith('DELETE'))).toBe(false)
})

it('rolls back both imported rows and initialization marker on a write failure', async () => {
  const client = database()
  const query = client.query.getMockImplementation()!
  client.query.mockImplementation(async (sql, args) => {
    if (sql.startsWith('INSERT INTO vessel_data.')) throw new Error('fixture write failure')
    return query(sql, args)
  })
  await expect(initializeAccount(client as never, 'alice', [{ database: 'vessel.db', name: 'example', schema: [], rows: [{ key: '0', value: encodeSyncRow({ id: 1 }) }] }], true)).rejects.toThrow('fixture write failure')
  expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
  expect(client.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO vessel_sync.account_initialization'))).toBe(false)
})
