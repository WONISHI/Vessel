import { EnhancedDatabase } from "@main/database/enhanced-database"
import { DATABASE_MIGRATIONS, DATABASE_VERSION } from "@main/database/database-schema"
import { AppStateRepository } from "@main/database/repositories/app-state.repository"

/**
 * @description Vessel 应用基础数据库。
 *
 * 在 EnhancedDatabase 通用数据库能力之上，
 * 负责 Vessel 数据库初始化相关工作。
 *
 * 当前类主要负责：
 * - 配置 SQLite 连接；
 * - 执行数据库结构迁移；
 * - 管理 SQLite user_version；
 * - 创建并暴露数据 Repository；
 * - 提供数据库文件路径及结构版本。
 *
 * 具体业务数据库可以继续继承当前类，
 * 在此基础上扩展设备、工作区、会话等业务能力。
 */
export class AppDatabase extends EnhancedDatabase {
  /**
   * @description 应用状态数据仓库。
   *
   * 用于统一读写 app_state 表中的通用应用状态。
   */
  readonly appStateRepository: AppStateRepository

  /**
   * @description 创建 Vessel 数据库。
   *
   * 初始化顺序：
   * 1. 创建 better-sqlite3 数据库连接；
   * 2. 配置 SQLite；
   * 3. 执行数据库结构迁移；
   * 4. 创建 Repository。
   *
   * @param databasePath SQLite 数据库文件绝对路径。
   * @throws 当数据库迁移失败或数据库版本不兼容时抛出异常。
   */
  constructor(databasePath: string) {
    super(databasePath)
    this.configureDatabase()
    this.migrateDatabase()
    this.appStateRepository = new AppStateRepository(this.database)
  }

  /**
   * @description 配置 SQLite 数据库连接。
   *
   * 当前配置包括：
   * - foreign_keys = ON：开启外键约束；
   * - journal_mode = WAL：启用 WAL 日志模式；
   * - synchronous = NORMAL：平衡数据安全和写入性能；
   * - busy_timeout = 5000：数据库占用时最多等待 5 秒。
   */
  private configureDatabase(): void {
    /**
     * 开启外键约束。
     */
    this.database.pragma("foreign_keys = ON")

    /**
     * 使用 WAL 模式，
     * 提升桌面应用并发读写能力。
     */
    this.database.pragma("journal_mode = WAL")

    /**
     * 在数据安全和写入性能之间取得平衡。
     */
    this.database.pragma("synchronous = NORMAL")

    /**
     * 数据库被占用时最多等待 5 秒。
     */
    this.database.pragma("busy_timeout = 5000")
  }

  /**
   * @description 创建或升级数据库结构。
   *
   * 使用 SQLite user_version 保存当前数据库结构版本，
   * 并按照 DATABASE_MIGRATIONS 中定义的顺序执行尚未完成的迁移。
   *
   * 迁移规则：
   * - 已完成的迁移不会重复执行；
   * - 数据库迁移版本必须连续递增；
   * - 每个迁移版本单独运行在事务中；
   * - SQL 执行成功后同步更新 user_version；
   * - SQL 或版本更新失败时整个当前版本迁移回滚；
   * - 最终数据库版本必须与 DATABASE_VERSION 一致。
   *
   * @throws 当数据库版本高于当前应用支持版本时抛出异常。
   * @throws 当迁移版本不连续时抛出异常。
   * @throws 当数据库迁移 SQL 执行失败时抛出异常。
   * @throws 当最终数据库版本与 DATABASE_VERSION 不一致时抛出异常。
   */
  private migrateDatabase(): void {
    let currentVersion = this.getDatabaseVersion()

    /**
     * 当前数据库版本高于应用支持版本，
     * 说明数据库曾被更高版本的应用打开。
     */
    if (currentVersion > DATABASE_VERSION) {
      throw new Error(`数据库版本 ${currentVersion} 高于当前应用支持的版本 ${DATABASE_VERSION}`)
    }

    for (const migration of DATABASE_MIGRATIONS) {
      /**
       * 已执行过的迁移直接跳过。
       */
      if (migration.version <= currentVersion) {
        continue
      }

      const expectedVersion = currentVersion + 1

      /**
       * 数据库迁移版本必须连续。
       */
      if (migration.version !== expectedVersion) {
        throw new Error(`数据库迁移版本不连续：当前版本 ${currentVersion}，期望版本 ${expectedVersion}，实际版本 ${migration.version}`)
      }

      /**
       * 每个版本单独执行事务。
       *
       * SQL 执行失败时，结构修改和 user_version
       * 都会一起回滚。
       */
      const executeMigration = this.database.transaction(() => {
        this.database.exec(migration.sql)

        this.database.pragma(`user_version = ${migration.version}`)
      })

      try {
        executeMigration()
      } catch (error) {
        throw new Error(`数据库迁移到版本 ${migration.version} 失败：${migration.description}`, {
          cause: error
        })
      }

      currentVersion = migration.version
    }

    /**
     * 确认迁移后的版本与当前应用版本一致。
     */
    if (currentVersion !== DATABASE_VERSION) {
      throw new Error(`数据库迁移未完成：当前版本 ${currentVersion}，目标版本 ${DATABASE_VERSION}`)
    }
  }

  /**
   * @description 获取当前 SQLite 数据库结构版本。
   *
   * 版本信息读取自 SQLite PRAGMA user_version。
   * 当 better-sqlite3 返回值不是 number 时，
   * 默认按照版本 0 处理。
   *
   * @returns 当前数据库结构版本。
   */
  private getDatabaseVersion(): number {
    const version = this.database.pragma("user_version", {
      simple: true
    })

    return typeof version === "number" ? version : 0
  }

  /**
   * @description 获取当前 SQLite 数据库文件路径。
   *
   * 返回 better-sqlite3 数据库连接的 name 属性。
   *
   * @returns SQLite 数据库文件路径。
   */
  getPath(): string {
    return this.database.name
  }

  /**
   * @description 获取当前数据库结构版本。
   *
   * 对外提供 SQLite user_version，
   * 用于调试信息、版本检查或数据库状态展示。
   *
   * @returns 当前数据库结构版本。
   */
  getVersion(): number {
    return this.getDatabaseVersion()
  }
}
