import { existsSync } from "node:fs"
import { join } from "node:path"
import { EnhancedDatabase } from "./enhanced-database"

/** Only application-owned databases can be inspected; paths never come from IPC. */
export const STORAGE_DATABASES = ["vessel.db", "browser-history.sqlite", "clipboard-history.sqlite", "todos.sqlite", "api_client.sqlite"] as const

export class StorageBrowser {
  constructor(private directory: string) {}

  private open(name: string) {
    if (!STORAGE_DATABASES.some((database) => database === name)) throw new TypeError("不支持的数据库")
    return new EnhancedDatabase(join(this.directory, name), { readonly: true, fileMustExist: true })
  }

  listTables() {
    return STORAGE_DATABASES.flatMap((name) => {
      if (!existsSync(join(this.directory, name))) return []
      const database = this.open(name)
      try {
        return database.getTables().map((table) => ({
          name: `${name}/${table.name}`,
          columns: database.getTableSchema(table.name),
          rowCount: database.getTableRowCount(table.name)
        }))
      } finally { database.close() }
    })
  }

  readTable(identifier: string, page = 1, keyword = "", pageSize = 50) {
    if (typeof identifier !== "string") throw new TypeError("数据表名称无效")
    // Preserve compatibility with older callers that only supplied a vessel.db table name.
    const [name, table] = identifier.includes("/") ? identifier.split("/") : ["vessel.db", identifier]
    if (!table || identifier.split("/").length > 2) throw new TypeError("数据表名称无效")
    const database = this.open(name)
    try {
      const result = database.searchTable(table, page, keyword, pageSize)
      return {
        ...result,
        rows: result.rows.map((row) => Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) =>
          [key, Buffer.isBuffer(value) ? `[BLOB ${value.byteLength} bytes]` : typeof value === "bigint" ? String(value) : value]
        )))
      }
    } finally { database.close() }
  }
}
