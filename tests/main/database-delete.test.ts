import { deleteDatabaseData } from '../../src/main/sync/database-sync/delete-data'
import { afterEach, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DATABASE_DELETE_CONFIRMATION, validateDatabaseDeletion } from '../../packages/@vessel/type/src/database-sync'
const state = vi.hoisted(() => ({ app: null as any }))
vi.mock('electron', () => ({ get app() { return state.app } }))
import { applyPendingLocalDatabaseDeletion, cancelPendingLocalDatabaseDeletion, requestLocalDatabaseDeletion } from '../../src/main/database/reset-local'
const directories: string[] = []
afterEach(() => { cancelPendingLocalDatabaseDeletion(); vi.clearAllTimers(); vi.useRealTimers(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })
function fixture() {
  vi.useFakeTimers()
  state.app = Object.assign(new EventEmitter(), { quit: vi.fn(), relaunch: vi.fn() })
  const directory = mkdtempSync(join(tmpdir(), 'vessel-delete-')); directories.push(directory)
  return directory
}
it('requires the exact scope-specific confirmation in main, including whitespace', () => {
  for (const scope of ['local', 'both', 'remote'] as const) {
    expect(validateDatabaseDeletion(scope, DATABASE_DELETE_CONFIRMATION[scope])).toBe(scope)
    expect(() => validateDatabaseDeletion(scope, DATABASE_DELETE_CONFIRMATION[scope] + ' ')).toThrow('不匹配')
    expect(() => validateDatabaseDeletion(scope, '')).toThrow('不匹配')
  }
  expect(() => validateDatabaseDeletion('all', '确认')).toThrow('范围')
})
it('only persists a reset on actual quit and removes only the five databases and their WAL/SHM on next startup', async () => {
  const directory = fixture()
  for (const file of ['vessel.db', 'vessel.db-wal', 'browser-history.sqlite', 'clipboard-history.sqlite', 'todos.sqlite', 'api_client.sqlite', 'password-vault.sqlite']) writeFileSync(join(directory, file), 'fixture')
  for (const file of ['note.md', 'unrelated.sqlite', 'database-sync.enc']) writeFileSync(join(directory, file), 'keep')
  requestLocalDatabaseDeletion(directory)
  expect(existsSync(join(directory, 'database-delete-on-start.json'))).toBe(false)
  await vi.advanceTimersByTimeAsync(150)
  expect(state.app.quit).toHaveBeenCalledOnce()
  expect(existsSync(join(directory, 'vessel.db'))).toBe(true)
  state.app.emit('quit')
  expect(state.app.relaunch).toHaveBeenCalledOnce()
  applyPendingLocalDatabaseDeletion(directory)
  expect(existsSync(join(directory, 'vessel.db'))).toBe(false)
  expect(existsSync(join(directory, 'vessel.db-wal'))).toBe(false)
  expect(existsSync(join(directory, 'password-vault.sqlite'))).toBe(false)
  expect(existsSync(join(directory, 'database-delete-on-start.json'))).toBe(false)
  for (const file of ['note.md', 'unrelated.sqlite', 'database-sync.enc']) expect(readFileSync(join(directory, file), 'utf8')).toBe('keep')
})
it('disarms deletion after cancellation so a later ordinary quit cannot delete data', () => {
  const directory = fixture()
  writeFileSync(join(directory, 'vessel.db'), 'keep')
  requestLocalDatabaseDeletion(directory)
  cancelPendingLocalDatabaseDeletion()
  state.app.emit('quit')
  expect(existsSync(join(directory, 'database-delete-on-start.json'))).toBe(false)
  expect(state.app.relaunch).not.toHaveBeenCalled()
  expect(readFileSync(join(directory, 'vessel.db'), 'utf8')).toBe('keep')
})

it('never schedules local deletion for mismatched text or a failed remote deletion', async () => {
  const remote = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('offline')), local = vi.fn()
  const operations = { configured: true, deleteRemote: remote, deleteLocal: local }
  await expect(deleteDatabaseData('both', 'wrong', operations)).rejects.toThrow('不匹配')
  expect(remote).not.toHaveBeenCalled()
  await expect(deleteDatabaseData('both', DATABASE_DELETE_CONFIRMATION.both, operations)).rejects.toThrow('offline')
  expect(local).not.toHaveBeenCalled()
  await expect(deleteDatabaseData('remote', DATABASE_DELETE_CONFIRMATION.remote, { ...operations, configured: false })).rejects.toThrow('尚未配置')
  remote.mockResolvedValue(undefined)
  expect(await deleteDatabaseData('both', DATABASE_DELETE_CONFIRMATION.both, operations)).toEqual({ restarting: true, remoteDeleted: true })
  expect(local).toHaveBeenCalledOnce()
  expect(remote.mock.invocationCallOrder.at(-1)!).toBeLessThan(local.mock.invocationCallOrder[0])
})
