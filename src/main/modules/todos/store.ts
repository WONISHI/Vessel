import Database from "better-sqlite3"
import type { Todo } from "../../../shared/todos"

export class TodoStore {
  private db: Database.Database
  constructor(path: string) {
    this.db = new Database(path)
    this.db.pragma("journal_mode = WAL")
    this.db.exec(`CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1))); CREATE INDEX IF NOT EXISTS todos_date ON todos(date);`)
  }
  list(): Todo[] {
    return (this.db.prepare("SELECT * FROM todos ORDER BY date, id").all() as (Omit<Todo, "completed"> & { completed: number })[]).map((row) => ({ ...row, completed: !!row.completed }))
  }
  add(date: string, title: string) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error("日期无效")
    if (typeof title !== "string" || !title.trim() || title.trim().length > 1000) throw new Error("待办内容需为 1–1000 字")
    this.db.prepare("INSERT INTO todos(date,title) VALUES (?,?)").run(date, title.trim())
    return this.list()
  }
  complete(id: number, completed: boolean) {
    this.checkId(id)
    if (typeof completed !== "boolean") throw new Error("完成状态无效")
    this.db.prepare("UPDATE todos SET completed=? WHERE id=?").run(Number(completed), id)
    return this.list()
  }
  remove(id: number) {
    this.checkId(id)
    this.db.prepare("DELETE FROM todos WHERE id=?").run(id)
    return this.list()
  }
  private checkId(id: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("待办编号无效")
  }
  close() {
    this.db.close()
  }
}
