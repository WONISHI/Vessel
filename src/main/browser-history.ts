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
    this.prune()
  }
  prune(now = Date.now()) { this.db.prepare("DELETE FROM visits WHERE visitedAt < ?").run(now - 30 * 86400000) }
  add(url: string, title: string, now = Date.now()) {
    if (!/^https?:\/\//i.test(url)) return
    this.prune(now)
    return Number(this.db.prepare("INSERT INTO visits (url,title,visitedAt) VALUES (?,?,?)").run(url, title.slice(0, 1000), now).lastInsertRowid)
  }
  title(id: number, title: string) { this.db.prepare("UPDATE visits SET title=? WHERE id=?").run(title.slice(0, 1000), id) }
  favicon(id: number, url: string) {
    if (/^https?:\/\//i.test(url) && url.length < 8192) this.db.prepare("UPDATE visits SET favicon=? WHERE id=?").run(url, id)
  }
  list(): HistoryEntry[] { this.prune(); return this.db.prepare("SELECT * FROM visits ORDER BY visitedAt DESC, id DESC").all() as HistoryEntry[] }
  delete(id: number | null) { if (id === null) this.db.exec("DELETE FROM visits"); else if (Number.isSafeInteger(id)) this.db.prepare("DELETE FROM visits WHERE id=?").run(id) }
  close() { this.db.close() }
}
