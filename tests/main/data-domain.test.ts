import { afterEach, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { TodoStore } from '@main/modules/todos/store'
import { assertDataClient, inRemoteMemory, notifyDataDomainChanged, readDataState, registerDataClient, runDataOperation, switchDataDomain } from '@main/database/data-domain'
import { RemoteDomainData } from '@main/database/remote-data'
const cleanups: (() => void)[] = []
afterEach(async () => { await switchDataDomain(); registerDataClient(0); for (const cleanup of cleanups.splice(0).reverse()) cleanup() })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'vessel-domain-test-'))
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))
  const path = join(directory, 'todos.sqlite'), store = new TodoStore(path)
  cleanups.push(() => store.close())
  store.add('2026-11-27', 'local')
  return { directory, path, store }
}
it('runs business SQL against the selected remote memory and preserves local rows on logout', async () => {
  const { path, store } = fixture(), remote = new Database(':memory:')
  remote.exec('CREATE TABLE todos(id INTEGER PRIMARY KEY, date TEXT, title TEXT, completed INTEGER); INSERT INTO todos VALUES(1,\'2026-11-27\',\'remote\',0)')
  await switchDataDomain({ run: (_names, action) => Promise.resolve(inRemoteMemory(new Map([[resolve(path), remote]]), action)), close: async () => { remote.close() } })
  expect(() => store.list()).toThrow('数据域上下文')
  expect((await runDataOperation(['todos.sqlite'], () => store.list()))[0].title).toBe('remote')
  await runDataOperation(['todos.sqlite'], () => store.add('2026-11-27', 'remote two'))
  await switchDataDomain()
  expect(store.list().map(todo => todo.title)).toEqual(['local'])
})
it('drains an in-flight operation and rejects new writes while switching domains', async () => {
  const { store } = fixture()
  let finish!: () => void
  const operation = runDataOperation(['todos.sqlite'], () => new Promise<void>(resolve => { finish = resolve }))
  await Promise.resolve()
  const switching = switchDataDomain()
  await expect(runDataOperation(['todos.sqlite'], () => store.add('2026-11-27', 'wrong domain'))).rejects.toThrow('切换数据域')
  finish(); await operation; await switching
  expect(store.list()).toHaveLength(1)
})
it('does not fall back to the local file when PostgreSQL is unavailable', async () => {
  const { directory, store } = fixture()
  const client = { on: vi.fn(), connect: vi.fn().mockRejectedValue(new Error('offline')), end: vi.fn().mockResolvedValue(undefined) }
  await switchDataDomain(new RemoteDomainData(directory, 'account', {}, () => client as any))
  await expect(runDataOperation(['todos.sqlite'], () => store.add('2026-11-27', 'must not save'))).rejects.toThrow('未写入本地')
  await switchDataDomain()
  expect(store.list().map(todo => todo.title)).toEqual(['local'])
})
it('rejects stale renderer clients until their new domain bootstrap completes', () => {
  registerDataClient(12)
  assertDataClient(12)
  notifyDataDomainChanged()
  expect(() => assertDataClient(12)).toThrow('数据域已切换')
  registerDataClient(12)
  expect(() => assertDataClient(12)).not.toThrow()
})

it('drains direct remote setting reads before switching and never calls the local fallback', async () => {
  let finish!: (value: unknown) => void
  const readState = vi.fn(() => new Promise(resolve => { finish = resolve })), local = vi.fn()
  const close = vi.fn().mockResolvedValue(undefined)
  await switchDataDomain({ readState, run: vi.fn(), close })
  const reading = readDataState('welcome:lastWorkspace', local)
  const switching = switchDataDomain()
  await expect(readDataState('other', local)).rejects.toThrow('正在切换')
  expect(close).not.toHaveBeenCalled()
  finish({ path: '/remote' })
  expect(await reading).toEqual({ path: '/remote' })
  await switching
  expect(close).toHaveBeenCalledOnce()
  expect(local).not.toHaveBeenCalled()
})

it('reuses a connection, coalesces simultaneous reads, and fetches fresh settings after completion', async () => {
  let value = 'first'
  const client = { on: vi.fn(), connect: vi.fn().mockResolvedValue(undefined), end: vi.fn().mockResolvedValue(undefined), query: vi.fn(async () => ({ rows: [{ value_json: JSON.stringify(value) }] })) }
  const remote = new RemoteDomainData('/unused', 'alice', {}, () => client as any)
  try {
    const first = remote.readState('workspace')
    expect(remote.readState('workspace')).toBe(first)
    expect(await first).toBe('first')
    value = 'changed by another device'
    expect(await remote.readState('workspace')).toBe(value)
    expect(client.connect).toHaveBeenCalledOnce()
    expect(client.query).toHaveBeenCalledTimes(2)
    expect(client.query.mock.calls[0]).toEqual([expect.stringContaining("data->'key'->>'value'=$2"), ['alice', 'workspace']])
  } finally { await remote.close() }
  expect(client.end).toHaveBeenCalledOnce()
})

it('drops a broken connection and reconnects on the next read without returning stale or local data', async () => {
  let attempts = 0
  const factory = vi.fn(() => ({ on: vi.fn(), connect: vi.fn().mockResolvedValue(undefined), end: vi.fn().mockResolvedValue(undefined), query: vi.fn(async () => {
    if (++attempts === 1) throw new Error('offline')
    return { rows: [{ value_json: '"fresh"' }] }
  }) }))
  const remote = new RemoteDomainData('/unused', 'alice', {}, factory as any)
  try {
    await expect(remote.readState('workspace')).rejects.toThrow('未写入本地')
    expect(await remote.readState('workspace')).toBe('fresh')
    expect(factory).toHaveBeenCalledTimes(2)
  } finally { await remote.close() }
})

it('batches a database snapshot into one read and avoids writing unchanged sequences', async () => {
  const { directory, store } = fixture()
  const client = { on: vi.fn(), connect: vi.fn().mockResolvedValue(undefined), end: vi.fn().mockResolvedValue(undefined), query: vi.fn(async () => ({ rows: [] })) }
  const remote = new RemoteDomainData(directory, 'alice', {}, () => client as any)
  await switchDataDomain(remote)
  expect(await runDataOperation(['todos.sqlite'], () => store.list())).toEqual([])
  client.query.mockClear()
  expect(await runDataOperation(['todos.sqlite'], () => store.list())).toEqual([])
  const queries = client.query.mock.calls.map(([sql]) => sql)
  expect(queries.filter(sql => sql.includes(' UNION ALL '))).toHaveLength(1)
  expect(queries.some(sql => sql.startsWith('INSERT') || sql.startsWith('DELETE'))).toBe(false)
  expect(client.connect).toHaveBeenCalledOnce()
})
