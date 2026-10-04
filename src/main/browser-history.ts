import { historyURLKey, isHistoryRedirect } from "../shared/browser-history-url"
import Database from "better-sqlite3"
import type { HistoryEntry } from "../shared/browser-tools"
export class BrowserHistory {
  private db: Database.Database
  constructor(path: string) {
    this.db = new Database(path)
    this.db.pragma("journal_mode = WAL")
    this.db.exec("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL, visitedAt INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS visits_time ON visits(visitedAt)")
    const columns = this.db.pragma("table_info(visits)") as { name: string }[]
    if (!columns.some(column => column.name === "favicon")) this.db.exec("ALTER TABLE visits ADD COLUMN favicon TEXT")
    this.db.exec("CREATE TABLE IF NOT EXISTS bookmarks (url TEXT PRIMARY KEY, title TEXT NOT NULL)")
    this.prune()
    this.compact()
  }
  private compact() {
    const rows = this.db.prepare("SELECT * FROM visits ORDER BY visitedAt DESC, id DESC").all() as HistoryEntry[]
    const latest = new Map<string, HistoryEntry>()
    this.db.transaction(() => {
      for (const row of rows) {
        const key = historyURLKey(row.url), next = latest.get(key)
        if (isHistoryRedirect(row.url) || (next && next.visitedAt - row.visitedAt < 60_000)) this.delete(row.id)
        else latest.set(key, row)
      }
    })()
  }
  prune(now = Date.now()) { this.db.prepare("DELETE FROM visits WHERE visitedAt < ?").run(now - 30 * 86400000) }
  add(url: string, title: string, now = Date.now()) {
    if (isHistoryRedirect(url)) return
    if (!/^https?:\/\//i.test(url)) return
    this.prune(now)
    const recent = this.db.prepare("SELECT * FROM visits WHERE visitedAt >= ? ORDER BY visitedAt DESC, id DESC").all(now - 60_000) as HistoryEntry[]
    const existing = recent.find(entry => historyURLKey(entry.url) === historyURLKey(url))
    if (existing) { this.db.prepare("UPDATE visits SET url=?, title=?, visitedAt=? WHERE id=?").run(url, title.slice(0, 1000), now, existing.id); return existing.id }
    return Number(this.db.prepare("INSERT INTO visits (url,title,visitedAt) VALUES (?,?,?)").run(url, title.slice(0, 1000), now).lastInsertRowid)
  }
  title(id: number, title: string) { this.db.prepare("UPDATE visits SET title=? WHERE id=?").run(title.slice(0, 1000), id) }
  favicon(id: number, url: string) {
    if (/^https?:\/\//i.test(url) && url.length < 8192) this.db.prepare("UPDATE visits SET favicon=? WHERE id=?").run(url, id)
  }
  setBookmarks(items: { url: string; title: string }[]) {
    if (!Array.isArray(items) || items.length > 10000 || items.some(item => !item || typeof item.url !== 'string' || !/^https?:\/\//i.test(item.url) || typeof item.title !== 'string')) throw new Error('书签数据无效')
    this.db.transaction(() => { this.db.exec('DELETE FROM bookmarks'); const insert = this.db.prepare('INSERT OR REPLACE INTO bookmarks(url,title) VALUES (?,?)'); for (const item of items) insert.run(item.url, item.title.slice(0,1000)) })()
  }
  list(): HistoryEntry[] { this.prune(); return this.db.prepare("SELECT visits.*, EXISTS(SELECT 1 FROM bookmarks WHERE bookmarks.url=visits.url) AS bookmarked FROM visits ORDER BY visitedAt DESC, id DESC").all() as HistoryEntry[] }
  delete(id: number | null) { if (id === null) this.db.exec("DELETE FROM visits"); else if (Number.isSafeInteger(id)) this.db.prepare("DELETE FROM visits WHERE id=?").run(id) }
  close() { this.db.close() }
}
