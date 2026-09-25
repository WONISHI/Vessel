import { afterEach, describe, expect, it } from "vitest"
import { EnhancedDatabase } from "../../src/main/database/enhanced-database"

class FixtureDatabase extends EnhancedDatabase {
  constructor() {
    super(":memory:")
    this.database.exec(`
      CREATE TABLE records (key TEXT PRIMARY KEY, age INTEGER, is_active BOOLEAN, created_at DATETIME);
      CREATE TABLE empty_table (id INTEGER PRIMARY KEY);
      INSERT INTO records VALUES ('alpha', 28, 1, '2024-01-15 09:30:00');
      INSERT INTO records VALUES ('beta', 35, 0, NULL);
    `)
  }
}
let database: FixtureDatabase | undefined
afterEach(() => database?.close())
describe("storage browser queries", () => {
  it("lists tables, preserves field types and primary keys, and reads separate pages", () => {
    database = new FixtureDatabase()
    expect(database.getTables().map((table) => table.name)).toEqual(["empty_table", "records"])
    expect(database.getTableSchema("records")).toEqual(expect.arrayContaining([expect.objectContaining({ name: "key", primaryKey: 1 }), expect.objectContaining({ name: "is_active", type: "BOOLEAN" }), expect.objectContaining({ name: "created_at", type: "DATETIME" })]))
    expect(database.searchTable("records", 2, "", 1)).toMatchObject({ total: 2, page: 2, rows: [{ key: "beta" }] })
    expect(database.searchTable("records", 99, "", 20)).toMatchObject({ total: 2, page: 1 })
    expect(database.searchTable("records", 1, "ALPHA")).toMatchObject({ total: 1, rows: [{ key: "alpha" }] })
    expect(database.searchTable("records", 99, "35")).toMatchObject({ total: 1, page: 1, rows: [{ key: "beta" }] })
    expect(database.searchTable("records", 1, "%").total).toBe(0)
    expect(database.searchTable("records", 1, "' OR 1=1 --").total).toBe(0)
    expect(database.getTableRowCount("records")).toBe(2)
    expect(database.getTableData("records", 1, 1)[0].key).toBe("alpha")
    expect(database.getTableData("records", 2, 1)[0]).toMatchObject({ key: "beta", is_active: 0, created_at: null })
    expect(database.getTableData("empty_table")).toEqual([])
    expect(() => database!.getTableData('records"; DROP TABLE records; --')).toThrow()
    expect(database.getTableRowCount("records")).toBe(2)
  })
})
