import Database from "better-sqlite3"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, it } from "vitest"
import { STORAGE_DATABASES, StorageBrowser } from "@main/database/storage-browser"

let directory: string
let browser: StorageBrowser
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "vessel-storage-browser-"))
  browser = new StorageBrowser(directory)
})
afterEach(() => { rmSync(directory, { recursive: true, force: true }) })

function create(name: string, label: string) {
  const db = new Database(join(directory, name))
  db.exec("CREATE TABLE entries (id INTEGER PRIMARY KEY, label TEXT, image BLOB)")
  const insert = db.prepare("INSERT INTO entries VALUES (?, ?, ?)")
  for (let id = 1; id <= 3; id++) insert.run(id, `${label}-${id}`, Buffer.from([1, 2, 3]))
  db.close()
}

it("groups tables from all five databases and keeps identical table names distinct", () => {
  for (const name of STORAGE_DATABASES) create(name, name)
  const tables = browser.listTables()
  expect(tables.map((table) => table.name)).toEqual(STORAGE_DATABASES.map((name) => `${name}/entries`))
  expect(tables.every((table) => table.rowCount === 3 && table.columns.length === 3)).toBe(true)
  for (const name of STORAGE_DATABASES) {
    const result = browser.readTable(`${name}/entries`, 2, "", 1)
    expect(result).toMatchObject({ page: 2, total: 3, rows: [{ id: 2, label: `${name}-2`, image: "[BLOB 3 bytes]" }] })
  }
})

it("searches the selected database and supports older main-database identifiers", () => {
  create("vessel.db", "main")
  create("todos.sqlite", "todo")
  expect(browser.readTable("todos.sqlite/entries", 1, "todo-2").rows).toHaveLength(1)
  expect(browser.readTable("entries", 1, "todo-2").total).toBe(0)
  expect(browser.readTable("entries", 1, "main").total).toBe(3)
})

it("does not create databases that have not been initialized", () => {
  expect(browser.listTables()).toEqual([])
  expect(() => browser.readTable("todos.sqlite/entries")).toThrow()
  expect(readdirSync(directory)).toEqual([])
})

it("rejects database paths, unknown files and SQL table injection", () => {
  create("vessel.db", "main")
  for (const name of ["../vessel.db/entries", "other.db/entries", "vessel.db/entries; DROP TABLE entries", "vessel.db/sqlite_schema"]) {
    expect(() => browser.readTable(name)).toThrow()
  }
  expect(browser.readTable("entries").total).toBe(3)
})
