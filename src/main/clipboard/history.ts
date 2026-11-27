import { createDomainDatabase } from "@main/database/data-domain"
import type { ClipboardEntry, ClipboardFilter, ClipboardKind } from "@vessel/type"
import Database from "better-sqlite3"
import { createHash } from "node:crypto"

export type ClipboardCapture = {
  kind: ClipboardKind
  text: string
  html?: string
  rtf?: string
  image?: Buffer
  thumbnail?: string
  files?: string[]
  fileFormat?: string
  fileData?: Buffer
}
type RecordRow = {
  id: number; kind: ClipboardKind; text: string; html: string; rtf: string
  image: Buffer | null; thumbnail: string | null; files: string
  fileFormat: string; fileData: Buffer | null; createdAt: number; pinned: number; size: number
}
const MAX_ENTRIES = 200
const MAX_BYTES = 64 * 1024 * 1024
export const MAX_CAPTURE_BYTES = 16 * 1024 * 1024

export function clipboardTextKind(text: string): ClipboardKind {
  const value = text.trim()
  if (/^#[\da-f]{3}(?:[\da-f]|[\da-f]{3}|[\da-f]{5})?$/i.test(value) || /^(?:rgb|hsl)a?\([\d.,%\s/+-]+\)$/i.test(value)) return "color"
  try { if (["https:", "http:"].includes(new URL(value).protocol) && !/\s/.test(value)) return "link" } catch { /* Ordinary text. */ }
  return "text"
}

/** Local, bounded history. Full clipboard payloads stay in the main process. */
export class ClipboardHistory {
  private db: Database.Database
  constructor(path: string) {
    this.db = createDomainDatabase(path)
    this.db.pragma("journal_mode = WAL")
    this.db.pragma("secure_delete = ON")
    this.db.exec(`CREATE TABLE IF NOT EXISTS clips (
      id INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
      text TEXT NOT NULL, html TEXT NOT NULL, rtf TEXT NOT NULL, image BLOB,
      thumbnail TEXT, files TEXT NOT NULL, fileFormat TEXT NOT NULL, fileData BLOB,
      createdAt INTEGER NOT NULL, pinned INTEGER NOT NULL DEFAULT 0, size INTEGER NOT NULL
    ); CREATE INDEX IF NOT EXISTS clips_time ON clips(pinned DESC, createdAt DESC)`)
  }

  add(capture: ClipboardCapture, now = Date.now()): number | undefined {
    const { kind, text, html = "", rtf = "", image, thumbnail, files = [], fileFormat = "", fileData } = capture
    const fileList = JSON.stringify(files)
    const size = Buffer.byteLength(text + html + rtf + fileList + (thumbnail || "")) + (image?.length || 0) + (fileData?.length || 0)
    if (!size || size > MAX_CAPTURE_BYTES || (!text && !image?.length && !files.length)) return
    const hash = createHash("sha256")
    for (const value of [kind, text, html, rtf, fileList, fileFormat]) hash.update(String(Buffer.byteLength(value)) + ":" + value)
    if (image) hash.update(image)
    if (fileData) hash.update(fileData)
    const digest = hash.digest("hex")
    return this.db.transaction(() => {
      this.db.prepare(`INSERT INTO clips(hash,kind,text,html,rtf,image,thumbnail,files,fileFormat,fileData,createdAt,size)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(hash) DO UPDATE SET createdAt=excluded.createdAt`).run(
        digest, kind, text, html, rtf, image || null, thumbnail || null, fileList, fileFormat, fileData || null, now, size
      )
      let total = this.db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(size),0) AS bytes FROM clips").get() as { count: number; bytes: number }
      while (total.count > MAX_ENTRIES || total.bytes > MAX_BYTES) {
        const oldest = this.db.prepare("SELECT id,size FROM clips WHERE pinned=0 ORDER BY createdAt,id LIMIT 1").get() as { id: number; size: number } | undefined
        if (!oldest) break
        this.db.prepare("DELETE FROM clips WHERE id=?").run(oldest.id)
        total = { count: total.count - 1, bytes: total.bytes - oldest.size }
      }
      return (this.db.prepare("SELECT id FROM clips WHERE hash=?").get(digest) as { id: number } | undefined)?.id
    })()
  }

  list(filter: ClipboardFilter = {}): ClipboardEntry[] {
    const query = typeof filter.query === "string" ? filter.query.slice(0, 500).trim() : ""
    const pattern = "%" + query.replace(/[\\%_]/g, "\\$&") + "%"
    const kind = ["text", "image", "link", "color", "files"].includes(filter.kind || "") ? filter.kind! : ""
    const rows = this.db.prepare(`SELECT id,kind,substr(text,1,6000) AS text,length(text) AS characters,thumbnail,files,createdAt,pinned,size FROM clips
      WHERE (?='' OR kind=?) AND (?=0 OR pinned=1) AND (?='' OR text LIKE ? ESCAPE '\\' OR files LIKE ? ESCAPE '\\')
      ORDER BY pinned DESC,createdAt DESC,id DESC`).all(kind, kind, filter.pinnedOnly ? 1 : 0, query, pattern, pattern) as (RecordRow & { characters: number })[]
    return rows.map((row) => ({ id: row.id, kind: row.kind, preview: row.text, thumbnail: row.thumbnail || undefined, files: JSON.parse(row.files), createdAt: row.createdAt, pinned: !!row.pinned, size: row.size, characters: row.characters }))
  }
  get(id: number): ClipboardCapture | undefined {
    if (!Number.isSafeInteger(id)) return
    const row = this.db.prepare("SELECT * FROM clips WHERE id=?").get(id) as RecordRow | undefined
    if (!row) return
    return { kind: row.kind, text: row.text, html: row.html, rtf: row.rtf, image: row.image || undefined, files: JSON.parse(row.files), fileFormat: row.fileFormat, fileData: row.fileData || undefined }
  }
  count(): number { return (this.db.prepare("SELECT COUNT(*) AS count FROM clips").get() as { count: number }).count }
  pin(id: number) {
    if (!Number.isSafeInteger(id)) throw new Error("记录无效")
    this.db.prepare("UPDATE clips SET pinned=1-pinned WHERE id=?").run(id)
  }
  remove(id: number) { if (Number.isSafeInteger(id)) this.db.prepare("DELETE FROM clips WHERE id=?").run(id) }
  clear() { this.db.exec("DELETE FROM clips WHERE pinned=0; PRAGMA wal_checkpoint(TRUNCATE)") }
  close() { this.db.close() }
}
