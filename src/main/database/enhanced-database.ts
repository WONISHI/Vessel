import Database from "better-sqlite3"

/**
 * SQLite 通用增强类。
 *
 * 不包含任何 Vessel 具体业务逻辑。
 */
export class EnhancedDatabase {
  protected readonly database: Database.Database
  constructor(databasePath: string) {
    this.database = new Database(databasePath)
  }

  /**
   * 获取所有业务表。
   */
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

  /**
   * 分页获取表数据。
   */
  getTableData(tableName: string, page = 1, pageSize = 50): Record<string, unknown>[] {
    const safeTableName = this.resolveTableName(tableName)
    const safePage = this.normalizePositiveInteger(page, 1, Number.MAX_SAFE_INTEGER)
    const safePageSize = this.normalizePositiveInteger(pageSize, 50, 200)
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

  /**
   * 获取表字段结构。
   */
  getTableSchema(tableName: string): Array<{
    cid: number
    name: string
    type: string
    notNull: number
    defaultValue: string | null
    primaryKey: number
  }> {
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
      .all(safeTableName) as Array<{
      cid: number
      name: string
      type: string
      notNull: number
      defaultValue: string | null
      primaryKey: number
    }>
  }

  /**
   * 获取表数据总数。
   */
  getTableRowCount(tableName: string): number {
    const safeTableName = this.resolveTableName(tableName)
    const quotedTableName = this.quoteIdentifier(safeTableName)
    const result = this.database
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM ${quotedTableName}
        `
      )
      .get() as {
      count: number
    }

    return result.count
  }

  /**
   * 校验动态表名。
   */
  protected resolveTableName(tableName: string): string {
    if (typeof tableName !== "string" || tableName.trim().length === 0 || tableName.length > 200) {
      throw new TypeError("数据库表名必须是长度为 1 到 200 的字符串")
    }

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
      .get(tableName) as
      | {
          name: string
        }
      | undefined

    if (!row) {
      throw new Error(`数据库表不存在或不允许访问：${tableName}`)
    }

    return row.name
  }

  /**
   * 安全引用标识符。
   */
  protected quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  /**
   * 规范化正整数。
   */
  protected normalizePositiveInteger(value: number, fallback: number, maximum: number): number {
    const normalizedValue = Number.isFinite(value) ? Math.trunc(value) : fallback
    return Math.min(Math.max(normalizedValue, 1), maximum)
  }

  /**
   * 关闭数据库。
   */
  close(): void {
    if (this.database.open) {
      this.database.close()
    }
  }
}
