import Database from "better-sqlite3"

/**
 * @description SQLite 通用增强数据库。
 *
 * 基于 better-sqlite3 提供数据库连接以及通用的数据查询能力。
 *
 * 当前类不包含任何 Vessel 具体业务逻辑，
 * 主要负责：
 * - 创建 SQLite 数据库连接；
 * - 查询数据库业务表；
 * - 查询表字段结构；
 * - 分页查询表数据；
 * - 查询表数据总数；
 * - 校验动态表名；
 * - 安全处理 SQLite 标识符；
 * - 关闭数据库连接。
 */
export class EnhancedDatabase {
  /**
   * @description better-sqlite3 数据库连接实例。
   *
   * 使用 protected 允许继承类直接访问数据库，
   * 但不向外部调用方公开原始数据库实例。
   */
  protected readonly database: Database.Database

  /**
   * @description 创建 SQLite 数据库连接。
   * @param databasePath SQLite 数据库文件绝对路径。
   */
  constructor(databasePath: string) {
    this.database = new Database(databasePath)
  }

  /**
   * @description 获取当前数据库中的所有业务表。
   *
   * 自动排除 SQLite 内部维护的 sqlite_* 系统表，
   * 并按照表名升序返回。
   *
   * @returns 数据库业务表列表。
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
   * @description 分页获取指定业务表的数据。
   *
   * 表名会先通过数据库结构进行校验，
   * 避免直接拼接未经验证的动态表名。
   *
   * page 最小值为 1，
   * pageSize 被限制在 1 到 200 之间。
   *
   * @param tableName 数据库表名。
   * @param page 当前页码，默认 1。
   * @param pageSize 每页数据数量，默认 50。
   * @returns 当前分页的数据库记录。
   * @throws 当表名为空、长度非法或表不存在时抛出异常。
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
   * @description 获取指定业务表的字段结构。
   *
   * 基于 SQLite pragma_table_info() 查询字段定义，
   * 并将 SQLite 原始字段名转换为更适合 TypeScript 使用的字段名。
   *
   * @param tableName 数据库表名。
   * @returns 数据库字段结构列表。
   * @throws 当表名为空、长度非法或表不存在时抛出异常。
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
   * @description 获取指定业务表的数据总数。
   * @param tableName 数据库表名。
   * @returns 当前表中的记录总数。
   * @throws 当表名为空、长度非法或表不存在时抛出异常。
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
   * @description 校验并解析动态数据库表名。
   *
   * 当前方法会：
   * - 校验表名必须是有效字符串；
   * - 限制表名长度为 1 到 200；
   * - 确认表真实存在；
   * - 排除 sqlite_* 系统表。
   *
   * 动态 SQL 在使用表名之前应先调用该方法，
   * 防止未经验证的表名直接参与 SQL 拼接。
   *
   * @param tableName 待校验的数据库表名。
   * @returns 数据库中真实存在的表名。
   * @throws 当表名格式非法时抛出 TypeError。
   * @throws 当表不存在或不允许访问时抛出 Error。
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
   * @description 安全引用 SQLite 标识符。
   *
   * 使用双引号包裹标识符，
   * 并将标识符内部的双引号转义为两个双引号。
   *
   * 主要用于已经通过业务校验的动态表名或字段名。
   *
   * @param identifier SQLite 标识符。
   * @returns 安全引用后的 SQLite 标识符。
   */
  protected quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  /**
   * @description 将数值规范化为指定范围内的正整数。
   *
   * 非有限数值使用 fallback，
   * 小数会通过 Math.trunc() 截断，
   * 最终结果限制在 1 到 maximum 之间。
   *
   * @param value 原始数值。
   * @param fallback value 非有效有限数值时使用的默认值。
   * @param maximum 允许的最大值。
   * @returns 规范化后的正整数。
   */
  protected normalizePositiveInteger(value: number, fallback: number, maximum: number): number {
    const normalizedValue = Number.isFinite(value) ? Math.trunc(value) : fallback

    return Math.min(Math.max(normalizedValue, 1), maximum)
  }

  /**
   * @description 关闭当前 SQLite 数据库连接。
   *
   * 如果数据库连接已经关闭，
   * 则不会重复调用 better-sqlite3 的 close()。
   */
  close(): void {
    if (this.database.open) {
      this.database.close()
    }
  }
}
