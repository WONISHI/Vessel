import Database from "better-sqlite3"

/**
 * SQLite 基础增强类。
 *
 * 负责提供与具体业务无关的数据库能力：
 * - 创建并持有 better-sqlite3 连接；
 * - 查询所有业务表；
 * - 查询指定表的数据；
 * - 查询指定表的字段结构；
 * - 安全校验动态表名；
 * - 安全处理 SQLite 标识符；
 * - 关闭数据库连接。
 *
 * 具体业务数据库可以继承该类，
 * 直接使用受保护的 database 连接。
 */
export class EnhancedDatabase {
  /**
   * better-sqlite3 数据库连接。
   *
   * 使用 protected，允许 AppDatabase 等子类访问，
   * 但不会直接暴露给类外部调用者。
   */
  protected readonly database: Database.Database

  /**
   * 创建并打开 SQLite 数据库。
   *
   * @param databasePath SQLite 数据库文件的绝对路径。
   */
  constructor(databasePath: string) {
    this.database = new Database(databasePath)
  }

  /**
   * 获取数据库中的所有业务表。
   *
   * 默认排除 sqlite_ 开头的 SQLite 内部表。
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
   * 分页获取指定表的数据。
   *
   * @param tableName 数据库真实表名。
   * @param page 当前页，从 1 开始。
   * @param pageSize 每页数量，最大 200。
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
   * 获取指定表的字段结构。
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
   * 获取指定表的数据总数。
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
   * 校验动态传入的表名。
   *
   * SQLite 的表名不能使用 ? 参数绑定，
   * 因此必须先从 sqlite_schema 查询真实表名，
   * 防止通过表名执行 SQL 注入。
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
   * 安全引用 SQLite 标识符。
   *
   * 该方法只能用于已经通过 resolveTableName
   * 校验过的表名或字段名。
   */
  protected quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  /**
   * 将分页参数限制在指定范围内。
   */
  protected normalizePositiveInteger(value: number, fallback: number, maximum: number): number {
    const normalizedValue = Number.isFinite(value) ? Math.trunc(value) : fallback
    return Math.min(Math.max(normalizedValue, 1), maximum)
  }

  /**
   * 关闭 better-sqlite3 数据库连接。
   *
   * 子类如果需要在关闭前执行其他操作，
   * 可以重写该方法并调用 super.close()。
   */
  close(): void {
    if (this.database.open) {
      this.database.close()
    }
  }
}
