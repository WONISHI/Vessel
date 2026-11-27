import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { STORAGE_DATABASES } from '../../database/storage-browser'

export type SyncTable = { database: string; name: string; schema: unknown[]; rows: { key: string; value: string }[] }
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
/** Tags every SQLite cell, preserving BLOB, 64-bit INTEGER, null and ordinary JSON-looking strings. */
export function encodeSyncRow(row: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
    Buffer.isBuffer(value) ? { type: 'blob', value: value.toString('base64') } : typeof value === 'bigint' ? { type: 'integer', value: String(value) } : typeof value === 'number' && !Number.isFinite(value) ? { type: 'number', value: String(value) } : { type: value === null ? 'null' : typeof value, value }
  ])))
}
export function remoteTableName(database: string, table: string) {
  const suffix = createHash('sha256').update(`${database}/${table}`).digest('hex').slice(0, 12)
  return `${database.replace(/[^a-z0-9]/gi, '_').slice(0, 18)}_${table.replace(/[^a-z0-9]/gi, '_').slice(0, 28)}_${suffix}`
}
/** Reads the same five allowlisted databases as the storage viewer. No renderer-supplied paths. */
export function collectLocalTables(directory: string, includeRows = true): SyncTable[] {
  const tables: SyncTable[] = []
  let totalBytes = 0
  for (const name of STORAGE_DATABASES) {
    const path = join(directory, name)
    if (!existsSync(path)) continue
    const db = new Database(path, { readonly: true, fileMustExist: true })
    db.defaultSafeIntegers(true)
    try {
      db.transaction(() => {
        const definitions = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]
        for (const { name: table } of definitions) {
          const schema = db.prepare(`PRAGMA table_info(${quote(table)})`).all()
          const rows: SyncTable['rows'] = []
          for (const row of includeRows ? db.prepare(`SELECT * FROM ${quote(table)}`).iterate() as Iterable<Record<string, unknown>> : []) {
            const value = encodeSyncRow(row)
            totalBytes += Buffer.byteLength(value)
            if (totalBytes > 256 * 1024 * 1024) throw new Error('本次数据库快照超过 256 MB，请清理过大的剪贴板或历史数据后重试；未上传任何数据')
            rows.push({ key: String(rows.length), value })
          }
          // Snapshot row positions also support tables without a primary key, including duplicate rows.
          tables.push({ database: name, name: table, schema: JSON.parse(JSON.stringify(schema, (_key, value) => typeof value === 'bigint' ? Number(value) : value)), rows })
        }
      })()
    } finally { db.close() }
  }
  return tables
}

/** Preserve deleted AUTOINCREMENT high-water marks when importing a local database. */
export function collectLocalSequences(directory: string): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {}
  for (const name of STORAGE_DATABASES) {
    const path = join(directory, name)
    if (!existsSync(path)) continue
    const db = new Database(path, { readonly: true, fileMustExist: true })
    try {
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").get()) {
        result[name] = (db.prepare('SELECT * FROM sqlite_sequence').safeIntegers(true).all() as Record<string, unknown>[]).map(row => JSON.parse(encodeSyncRow(row)))
      }
    } finally { db.close() }
  }
  return result
}
