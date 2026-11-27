import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { STORAGE_DATABASES } from './storage-browser'
const markerName = 'database-delete-on-start.json'
let pending: (() => void) | undefined
/** Cancellation must disarm the pending intent, not leave deletion armed for a later quit. */
export function cancelPendingLocalDatabaseDeletion() {
  if (pending) app.removeListener('quit', pending)
  pending = undefined
}
/** Called before any database/module opens, after the previous process closed its SQLite handles. */
export function applyPendingLocalDatabaseDeletion(directory: string) {
  const marker = join(directory, markerName)
  if (!existsSync(marker)) return
  const value = JSON.parse(readFileSync(marker, 'utf8'))
  if (value?.format !== 'vessel-delete-local-databases-v1') throw new Error('数据库删除任务格式无效')
  for (const database of [...STORAGE_DATABASES, 'password-vault.sqlite']) {
    for (const suffix of ['', '-wal', '-shm']) rmSync(join(directory, database + suffix), { force: true })
  }
  for (const file of ['vault.json', 'vault.json.migrated', 'vault.json.tmp']) rmSync(join(directory, 'password-vault', file), { force: true })
  rmSync(marker)
}
/** Only schedule a marker on an actual quit; cancelled before-unload/write-drain leaves no disk intent. */
export function requestLocalDatabaseDeletion(directory: string) {
  if (pending) throw new Error('已在准备重启并删除本地数据库')
  pending = () => {
    writeFileSync(join(directory, markerName), JSON.stringify({ format: 'vessel-delete-local-databases-v1' }), { mode: 0o600 })
    pending = undefined
    app.relaunch()
  }
  app.once('quit', pending)
  // Allow the IPC response and confirmation dialog to settle before closing windows.
  setTimeout(() => app.quit(), 150)
}
