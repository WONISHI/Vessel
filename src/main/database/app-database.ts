import { EnhancedDatabase } from "./enhanced-database"
import { DATABASE_MIGRATIONS, DATABASE_VERSION } from "./database-schema"
import { AppStateRepository } from "./repositories/app-state.repository"

export class AppDatabase extends EnhancedDatabase {
  /**
   * @description 应用状态数据仓库。
   */
  readonly appStateRepository: AppStateRepository

  /**
   * @description 创建 Vessel 数据库。
   * @param databasePath SQLite 数据库文件绝对路径。
   */
  constructor(databasePath: string) {
    super(databasePath)
    this.configureDatabase()
    this.migrateDatabase()
    this.appStateRepository = new AppStateRepository(this.database)
  }

  /**
   * @description 配置 SQLite 连接。
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
   * 创建或升级数据库结构。
   *
   * 使用 SQLite user_version 保存当前数据库版本，
   * 按 DATABASE_MIGRATIONS 顺序执行尚未完成的迁移。
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
   * 获取当前 SQLite 数据库版本。
   */
  private getDatabaseVersion(): number {
    const version = this.database.pragma("user_version", {
      simple: true
    })

    return typeof version === "number" ? version : 0
  }

  /**
   * 获取数据库文件路径。
   */
  getPath(): string {
    return this.database.name
  }

  /**
   * 获取当前数据库结构版本。
   */
  getVersion(): number {
    return this.getDatabaseVersion()
  }
}
