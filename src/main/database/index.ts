import Database from "better-sqlite3"

export class EnhancedDatabase {
  protected readonly database: Database.Database
  constructor(databasePath: string) {
    this.database = new Database(databasePath)
  }

  /** 获取所有业务表。 */
  getTables(): Array<{
    name: string
    sql: string | null
  }> {
    return this.database
      .prepare(
        `
        SELECT
          name,
          sql
        FROM sqlite_schema
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name ASC
      `
      )
      .all() as Array<{
      name: string
      sql: string | null
    }>
  }

  /** 获取指定表的数据。 */
  getTableData(tableName: string, page = 1, pageSize = 50): Record<string, unknown>[] {
    const safeTableName = this.resolveTableName(tableName)
    const safePage = Math.max(Math.trunc(page), 1)
    const safePageSize = Math.min(Math.max(Math.trunc(pageSize), 1), 200)
    const offset = (safePage - 1) * safePageSize
    const quotedTableName = this.quoteIdentifier(safeTableName)
    return this.database
      .prepare(
        `
        SELECT *
        FROM ${quotedTableName}
        LIMIT ?
        OFFSET ?
      `
      )
      .all(safePageSize, offset) as Record<string, unknown>[]
  }

  /** 获取指定表的字段结构。 */
  getTableSchema(tableName: string) {
    const safeTableName = this.resolveTableName(tableName)
    return this.database
      .prepare(
        `
        SELECT
          cid,
          name,
          type,
          "notnull" AS "notNull",
          dflt_value AS "defaultValue",
          pk AS "primaryKey"
        FROM pragma_table_info(?)
        ORDER BY cid ASC
      `
      )
      .all(safeTableName)
  }

  /** 确保查询的表真实存在。 */
  private resolveTableName(tableName: string): string {
    const row = this.database
      .prepare(
        `
        SELECT name
        FROM sqlite_schema
        WHERE type = 'table'
          AND name = ?
          AND name NOT LIKE 'sqlite_%'
      `
      )
      .get(tableName) as { name: string } | undefined

    if (!row) {
      throw new Error(`数据库表不存在：${tableName}`)
    }

    return row.name
  }

  /** 安全处理动态表名。 */
  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  close(): void {
    this.database.close()
  }
}
