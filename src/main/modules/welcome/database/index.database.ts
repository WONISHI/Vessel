import { app } from "electron"
import { randomUUID } from "crypto"
import { existsSync, mkdirSync } from "fs"
import { arch, cpus, hostname, platform, release, totalmem, type, version } from "os"
import { dirname, join, normalize, resolve } from "path"
import { DATABASE_VERSION, DATABASE_TABLE_LABELS, DATABASE_COLUMN_LABELS } from "@main/modules/welcome/constants/index.constant"
import { EnhancedDatabase } from "@main/database/index"
import type {
  WorkspaceDataInput,
  PersistedWorkspaceData,
  RecentWorkspace,
  WorkspaceOpenRecord,
  DeviceInfo,
  WorkspaceRow,
  DatabaseColumnInfo,
  DatabaseTableData,
  DatabaseTableInfo
} from "@main/modules/welcome/index.type"

/**
 * Vessel 本地数据库管理器。
 *
 * AppDatabase 继承 EnhancedDatabase：
 * - EnhancedDatabase 负责通用 SQLite 能力；
 * - AppDatabase 负责 Vessel 具体业务逻辑。
 *
 * 该类只在 Electron 主进程中创建，负责：
 * 1. 初始化和迁移 SQLite 数据库；
 * 2. 维护设备与应用会话信息；
 * 3. 保存工作区及其每次打开记录；
 * 4. 提供通用 JSON 状态持久化能力；
 * 5. 为 DevTools 提供数据库表查看能力。
 */
export class AppDatabase extends EnhancedDatabase {
  /** vessel.db 在当前设备上的绝对路径。 */
  private readonly databasePath: string

  /**
   * 当前设备的持久化 ID。
   *
   * 同一份 Electron userData 下不会随应用重启变化。
   */
  private readonly deviceId: string

  /**
   * 本次应用运行的会话 ID。
   *
   * 每次启动应用都会重新生成。
   */
  private readonly sessionId = randomUUID()

  /** 防止数据库连接被重复关闭。 */
  private closed = false

  constructor() {
    /**
     * 数据库统一存放在 Electron userData 目录。
     *
     * 不应该放在用户选择的工作区中，否则：
     * - 切换工作区时可能丢失全局数据；
     * - 用户可能误删数据库；
     * - 多个工作区无法共享应用状态。
     */
    const databasePath = join(app.getPath("userData"), "vessel.db")

    /**
     * 首次运行时 userData 目录可能尚未创建。
     */
    mkdirSync(dirname(databasePath), {
      recursive: true
    })

    /**
     * 调用 EnhancedDatabase 构造函数。
     *
     * 父类负责创建并持有唯一的 better-sqlite3 连接，
     * 后续可以通过 this.database 使用该连接。
     */
    super(databasePath)

    this.databasePath = databasePath

    /**
     * 数据库连接创建完成后：
     * 1. 配置 SQLite；
     * 2. 执行数据库迁移；
     * 3. 获取当前设备 ID；
     * 4. 更新当前设备信息；
     * 5. 创建本次应用会话。
     */
    this.configure()
    this.migrate()

    this.deviceId = this.resolveDeviceId()

    this.upsertCurrentDevice()
    this.startSession()
  }

  /**
   * 配置 SQLite 连接级参数。
   */
  private configure(): void {
    /**
     * WAL 模式可以提升并发读写能力。
     *
     * 比较适合桌面应用频繁读取、少量写入的场景。
     */
    this.database.pragma("journal_mode = WAL")

    /**
     * 启用外键约束。
     *
     * 保证工作区、设备、应用会话之间的数据关系有效。
     */
    this.database.pragma("foreign_keys = ON")

    /**
     * NORMAL 在安全性和写入性能之间取得平衡。
     */
    this.database.pragma("synchronous = NORMAL")

    /**
     * 数据库暂时被占用时最多等待 5 秒，
     * 避免立即抛出 SQLITE_BUSY。
     */
    this.database.pragma("busy_timeout = 5000")
  }

  /**
   * 创建和升级数据库表结构。
   *
   * 使用 SQLite user_version 保存当前数据库版本。
   */
  private migrate(): void {
    let currentVersion = this.database.pragma("user_version", {
      simple: true
    }) as number

    /**
     * 防止旧版应用打开新版应用创建的数据库。
     */
    if (currentVersion > DATABASE_VERSION) {
      throw new Error(`数据库版本 ${currentVersion} 高于当前应用支持的版本 ${DATABASE_VERSION}`)
    }

    /**
     * 数据库版本 1。
     *
     * 创建应用最初需要的表和索引。
     */
    if (currentVersion < 1) {
      this.database.transaction(() => {
        this.database.exec(`
          -- 应用内部元数据。
          -- 当前用于保存不会随应用重启变化的设备 ID。
          CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          -- 当前设备的软硬件环境和应用运行版本。
          CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            hostname TEXT NOT NULL,
            platform TEXT NOT NULL,
            arch TEXT NOT NULL,
            os_type TEXT NOT NULL,
            os_release TEXT NOT NULL,
            os_version TEXT NOT NULL,
            cpu_model TEXT NOT NULL,
            cpu_count INTEGER NOT NULL,
            total_memory INTEGER NOT NULL,
            locale TEXT NOT NULL,
            timezone TEXT NOT NULL,
            app_version TEXT NOT NULL,
            electron_version TEXT NOT NULL,
            node_version TEXT NOT NULL,
            first_seen_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL
          );

          -- 每次启动应用都会创建一条会话。
          -- 应用退出时为 ended_at 补充结束时间。
          CREATE TABLE IF NOT EXISTS app_sessions (
            id TEXT PRIMARY KEY,
            device_id TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            app_version TEXT NOT NULL,
            electron_version TEXT NOT NULL,
            node_version TEXT NOT NULL,
            platform TEXT NOT NULL,
            arch TEXT NOT NULL,
            FOREIGN KEY (device_id) REFERENCES devices(id)
          );

          -- 工作区汇总表。
          -- 同一个规范路径只保留一条数据并累计打开次数。
          CREATE TABLE IF NOT EXISTS workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            normalized_path TEXT NOT NULL UNIQUE,
            file_count INTEGER NOT NULL DEFAULT 0,
            first_opened_at TEXT NOT NULL,
            last_opened_at TEXT NOT NULL,
            open_count INTEGER NOT NULL DEFAULT 1,
            is_available INTEGER NOT NULL DEFAULT 1,
            last_device_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (last_device_id) REFERENCES devices(id)
          );

          -- 工作区打开明细表。
          -- 每次打开工作区都会追加一条记录。
          CREATE TABLE IF NOT EXISTS workspace_open_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL,
            device_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            path TEXT NOT NULL,
            file_count INTEGER NOT NULL DEFAULT 0,
            opened_at TEXT NOT NULL,
            app_version TEXT NOT NULL,
            electron_version TEXT NOT NULL,
            platform TEXT NOT NULL,
            arch TEXT NOT NULL,
            FOREIGN KEY (
              workspace_id
            ) REFERENCES workspaces(id) ON DELETE CASCADE,
            FOREIGN KEY (
              device_id
            ) REFERENCES devices(id),
            FOREIGN KEY (
              session_id
            ) REFERENCES app_sessions(id)
          );

          -- 通用应用状态表。
          -- 用于保存主题、布局、编辑器设置等 JSON 数据。
          CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            device_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (
              device_id
            ) REFERENCES devices(id)
          );

          -- 最近打开工作区查询索引。
          CREATE INDEX IF NOT EXISTS idx_workspaces_last_opened_at
            ON workspaces(last_opened_at DESC);

          -- 按工作区查询打开明细的索引。
          CREATE INDEX IF NOT EXISTS idx_workspace_open_records_workspace_id
            ON workspace_open_records(
              workspace_id,
              opened_at DESC
            );

          -- 按设备查询打开明细的索引。
          CREATE INDEX IF NOT EXISTS idx_workspace_open_records_device_id
            ON workspace_open_records(
              device_id,
              opened_at DESC
            );
        `)

        /**
         * 当前事务只完成版本 1 的迁移，
         * 因此这里只能写入版本 1。
         */
        this.database.pragma("user_version = 1")
      })()

      currentVersion = 1
    }

    /**
     * 数据库版本 2。
     *
     * 为工作区打开记录补充完整的设备和运行环境快照。
     */
    if (currentVersion < 2) {
      this.database.transaction(() => {
        this.database.exec(`
          ALTER TABLE workspace_open_records
            ADD COLUMN hostname TEXT NOT NULL DEFAULT 'unknown';

          ALTER TABLE workspace_open_records
            ADD COLUMN os_type TEXT NOT NULL DEFAULT 'unknown';

          ALTER TABLE workspace_open_records
            ADD COLUMN os_release TEXT NOT NULL DEFAULT 'unknown';

          ALTER TABLE workspace_open_records
            ADD COLUMN os_version TEXT NOT NULL DEFAULT 'unknown';

          ALTER TABLE workspace_open_records
            ADD COLUMN cpu_model TEXT NOT NULL DEFAULT 'unknown';

          ALTER TABLE workspace_open_records
            ADD COLUMN cpu_count INTEGER NOT NULL DEFAULT 0;

          ALTER TABLE workspace_open_records
            ADD COLUMN total_memory INTEGER NOT NULL DEFAULT 0;

          ALTER TABLE workspace_open_records
            ADD COLUMN locale TEXT NOT NULL DEFAULT 'unknown';

          ALTER TABLE workspace_open_records
            ADD COLUMN timezone TEXT NOT NULL DEFAULT 'unknown';

          ALTER TABLE workspace_open_records
            ADD COLUMN node_version TEXT NOT NULL DEFAULT 'unknown';

          -- 版本 1 已有的记录没有设备快照。
          -- 使用关联设备当前保存的信息进行一次回填。
          UPDATE workspace_open_records
          SET
            hostname = COALESCE((
              SELECT devices.hostname
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 'unknown'),

            os_type = COALESCE((
              SELECT devices.os_type
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 'unknown'),

            os_release = COALESCE((
              SELECT devices.os_release
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 'unknown'),

            os_version = COALESCE((
              SELECT devices.os_version
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 'unknown'),

            cpu_model = COALESCE((
              SELECT devices.cpu_model
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 'unknown'),

            cpu_count = COALESCE((
              SELECT devices.cpu_count
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 0),

            total_memory = COALESCE((
              SELECT devices.total_memory
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 0),

            locale = COALESCE((
              SELECT devices.locale
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 'unknown'),

            timezone = COALESCE((
              SELECT devices.timezone
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 'unknown'),

            node_version = COALESCE((
              SELECT devices.node_version
              FROM devices
              WHERE devices.id =
                workspace_open_records.device_id
            ), 'unknown');
        `)

        this.database.pragma("user_version = 2")
      })()
    }
  }

  /**
   * 获取当前设备的持久化 ID。
   *
   * 第一次运行时生成 UUID，
   * 之后始终从 app_metadata 中读取。
   */
  private resolveDeviceId(): string {
    const row = this.database
      .prepare(
        `
        SELECT value
        FROM app_metadata
        WHERE key = ?
      `
      )
      .get("device.id") as
      | {
          value: string
        }
      | undefined

    /**
     * 已经存在时直接复用，
     * 确保同一设备上的打开历史能够关联起来。
     */
    if (row?.value) {
      return row.value
    }

    /**
     * 首次运行时生成并写入数据库。
     */
    const deviceId = randomUUID()
    const now = new Date().toISOString()

    this.database
      .prepare(
        `
        INSERT INTO app_metadata (
          key,
          value,
          updated_at
        )
        VALUES (?, ?, ?)
      `
      )
      .run("device.id", deviceId, now)

    return deviceId
  }

  /**
   * 收集当前设备和应用环境中可能变化的信息。
   */
  private getCurrentDeviceValues(now: string): Omit<DeviceInfo, "id" | "firstSeenAt"> {
    const cpuList = cpus()

    return {
      hostname: hostname(),
      platform: platform(),
      arch: arch(),
      osType: type(),
      osRelease: release(),
      osVersion: version(),
      cpuModel: cpuList[0]?.model ?? "unknown",
      cpuCount: cpuList.length,
      totalMemory: totalmem(),
      locale: app.getLocale(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron ?? "unknown",
      nodeVersion: process.versions.node,
      lastSeenAt: now
    }
  }

  /**
   * 新增或刷新当前设备信息。
   *
   * first_seen_at 只在首次插入时保存，
   * 后续启动只更新 last_seen_at 等可变信息。
   */
  private upsertCurrentDevice(): void {
    const now = new Date().toISOString()
    const device = this.getCurrentDeviceValues(now)

    this.database
      .prepare(
        `
        INSERT INTO devices (
          id,
          hostname,
          platform,
          arch,
          os_type,
          os_release,
          os_version,
          cpu_model,
          cpu_count,
          total_memory,
          locale,
          timezone,
          app_version,
          electron_version,
          node_version,
          first_seen_at,
          last_seen_at
        )
        VALUES (
          @id,
          @hostname,
          @platform,
          @arch,
          @osType,
          @osRelease,
          @osVersion,
          @cpuModel,
          @cpuCount,
          @totalMemory,
          @locale,
          @timezone,
          @appVersion,
          @electronVersion,
          @nodeVersion,
          @firstSeenAt,
          @lastSeenAt
        )
        ON CONFLICT(id) DO UPDATE SET
          hostname = excluded.hostname,
          platform = excluded.platform,
          arch = excluded.arch,
          os_type = excluded.os_type,
          os_release = excluded.os_release,
          os_version = excluded.os_version,
          cpu_model = excluded.cpu_model,
          cpu_count = excluded.cpu_count,
          total_memory = excluded.total_memory,
          locale = excluded.locale,
          timezone = excluded.timezone,
          app_version = excluded.app_version,
          electron_version = excluded.electron_version,
          node_version = excluded.node_version,
          last_seen_at = excluded.last_seen_at
      `
      )
      .run({
        id: this.deviceId,
        ...device,
        firstSeenAt: now
      })
  }

  /**
   * 创建本次应用启动会话。
   *
   * ended_at 会在 close() 中补充。
   */
  private startSession(): void {
    const now = new Date().toISOString()

    this.database
      .prepare(
        `
        INSERT INTO app_sessions (
          id,
          device_id,
          started_at,
          app_version,
          electron_version,
          node_version,
          platform,
          arch
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(this.sessionId, this.deviceId, now, app.getVersion(), process.versions.electron ?? "unknown", process.versions.node, platform(), arch())
  }

  /**
   * 生成用于判断工作区是否相同的规范路径。
   *
   * Windows 路径不区分大小写，
   * 因此 Windows 下额外转换为小写。
   */
  private normalizeWorkspacePath(workspacePath: string): string {
    const normalizedPath = normalize(resolve(workspacePath))

    return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath
  }

  /**
   * 保存一次工作区打开操作。
   *
   * 同一个事务内完成：
   * 1. 新增或更新工作区汇总信息；
   * 2. 查询更新后的工作区主键和累计次数；
   * 3. 追加一条不会被覆盖的打开历史。
   */
  recordWorkspaceOpened(workspace: WorkspaceDataInput): PersistedWorkspaceData {
    const openedAt = new Date().toISOString()

    const normalizedPath = this.normalizeWorkspacePath(workspace.path)

    const isAvailable = existsSync(workspace.path) ? 1 : 0

    const fileCount = workspace.files.length

    /**
     * 读取当前设备快照。
     *
     * 快照写入打开明细后，
     * 不再受 devices 表后续更新影响。
     */
    const device = this.getCurrentDevice()

    const transaction = this.database.transaction(() => {
      /**
       * normalized_path 具有唯一约束：
       * - 首次打开时新增；
       * - 再次打开时更新并累加 open_count。
       */
      this.database
        .prepare(
          `
            INSERT INTO workspaces (
              name,
              path,
              normalized_path,
              file_count,
              first_opened_at,
              last_opened_at,
              open_count,
              is_available,
              last_device_id,
              created_at,
              updated_at
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              1,
              ?,
              ?,
              ?,
              ?
            )
            ON CONFLICT(normalized_path) DO UPDATE SET
              name = excluded.name,
              path = excluded.path,
              file_count = excluded.file_count,
              last_opened_at = excluded.last_opened_at,
              open_count = workspaces.open_count + 1,
              is_available = excluded.is_available,
              last_device_id = excluded.last_device_id,
              updated_at = excluded.updated_at
          `
        )
        .run(workspace.name, workspace.path, normalizedPath, fileCount, openedAt, openedAt, isAvailable, this.deviceId, openedAt, openedAt)

      /**
       * 查询 UPSERT 后的最终工作区数据。
       */
      const savedWorkspace = this.database
        .prepare(
          `
            SELECT
              id,
              name,
              path,
              file_count,
              first_opened_at,
              last_opened_at,
              open_count,
              is_available,
              last_device_id
            FROM workspaces
            WHERE normalized_path = ?
          `
        )
        .get(normalizedPath) as WorkspaceRow

      /**
       * 汇总表会被更新，
       * 但打开明细始终执行 INSERT。
       */
      this.database
        .prepare(
          `
            INSERT INTO workspace_open_records (
              workspace_id,
              device_id,
              session_id,
              path,
              file_count,
              opened_at,
              hostname,
              os_type,
              os_release,
              os_version,
              cpu_model,
              cpu_count,
              total_memory,
              locale,
              timezone,
              app_version,
              electron_version,
              node_version,
              platform,
              arch
            )
            VALUES (
              @workspaceId,
              @deviceId,
              @sessionId,
              @path,
              @fileCount,
              @openedAt,
              @hostname,
              @osType,
              @osRelease,
              @osVersion,
              @cpuModel,
              @cpuCount,
              @totalMemory,
              @locale,
              @timezone,
              @appVersion,
              @electronVersion,
              @nodeVersion,
              @platform,
              @arch
            )
          `
        )
        .run({
          workspaceId: savedWorkspace.id,
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          path: workspace.path,
          fileCount,
          openedAt,
          hostname: device.hostname,
          osType: device.osType,
          osRelease: device.osRelease,
          osVersion: device.osVersion,
          cpuModel: device.cpuModel,
          cpuCount: device.cpuCount,
          totalMemory: device.totalMemory,
          locale: device.locale,
          timezone: device.timezone,
          appVersion: device.appVersion,
          electronVersion: device.electronVersion,
          nodeVersion: device.nodeVersion,
          platform: device.platform,
          arch: device.arch
        })

      return savedWorkspace
    })

    /**
     * better-sqlite3 的 transaction 返回可执行函数。
     *
     * 此处调用后事务才会真正执行。
     */
    const savedWorkspace = transaction()

    return {
      ...workspace,
      id: savedWorkspace.id,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      firstOpenedAt: savedWorkspace.first_opened_at,
      lastOpenedAt: savedWorkspace.last_opened_at,
      openedAt,
      openCount: savedWorkspace.open_count
    }
  }

  /**
   * 查询最近打开的工作区。
   *
   * limit 被限制在 1 到 100 之间。
   */
  getRecentWorkspaces(limit = 10): RecentWorkspace[] {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)

    const rows = this.database
      .prepare(
        `
        SELECT
          id,
          name,
          path,
          file_count,
          first_opened_at,
          last_opened_at,
          open_count,
          is_available,
          last_device_id
        FROM workspaces
        ORDER BY last_opened_at DESC
        LIMIT ?
      `
      )
      .all(safeLimit) as WorkspaceRow[]

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      path: row.path,
      fileCount: row.file_count,
      firstOpenedAt: row.first_opened_at,
      lastOpenedAt: row.last_opened_at,
      openCount: row.open_count,

      /**
       * 实时检查目录是否仍然存在，
       * 不依赖数据库中保存的历史状态。
       */
      isAvailable: existsSync(row.path),

      deviceId: row.last_device_id
    }))
  }

  /**
   * 查询指定工作区的打开明细。
   *
   * 返回每次打开工作区时保存的：
   * - 工作区路径和文件数量；
   * - 设备及操作系统信息；
   * - CPU、内存、语言和时区；
   * - 应用、Electron 和 Node.js 版本。
   *
   * limit 被限制在 1 到 500 之间。
   */
  getWorkspaceOpenRecords(workspaceId: number, limit = 100): WorkspaceOpenRecord[] {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500)

    /**
     * 使用 AS 将数据库的 snake_case 字段
     * 转换成渲染进程使用的 camelCase。
     */
    return this.database
      .prepare(
        `
        SELECT
          id,
          workspace_id AS workspaceId,
          device_id AS deviceId,
          session_id AS sessionId,
          path,
          file_count AS fileCount,
          opened_at AS openedAt,
          hostname,
          os_type AS osType,
          os_release AS osRelease,
          os_version AS osVersion,
          cpu_model AS cpuModel,
          cpu_count AS cpuCount,
          total_memory AS totalMemory,
          locale,
          timezone,
          app_version AS appVersion,
          electron_version AS electronVersion,
          node_version AS nodeVersion,
          platform,
          arch
        FROM workspace_open_records
        WHERE workspace_id = ?
        ORDER BY opened_at DESC
        LIMIT ?
      `
      )
      .all(workspaceId, safeLimit) as WorkspaceOpenRecord[]
  }

  /**
   * 获取数据库中保存的当前设备信息。
   */
  getCurrentDevice(): DeviceInfo {
    return this.database
      .prepare(
        `
        SELECT
          id,
          hostname,
          platform,
          arch,
          os_type AS osType,
          os_release AS osRelease,
          os_version AS osVersion,
          cpu_model AS cpuModel,
          cpu_count AS cpuCount,
          total_memory AS totalMemory,
          locale,
          timezone,
          app_version AS appVersion,
          electron_version AS electronVersion,
          node_version AS nodeVersion,
          first_seen_at AS firstSeenAt,
          last_seen_at AS lastSeenAt
        FROM devices
        WHERE id = ?
      `
      )
      .get(this.deviceId) as DeviceInfo
  }

  /**
   * 查询数据库中的所有业务表。
   *
   * 复用 EnhancedDatabase.getTables()，
   * 然后补充中文表名和数据总数。
   */
  getDatabaseTables(): DatabaseTableInfo[] {
    return this.getTables().map((table) => ({
      name: table.name,
      label: this.getDatabaseTableLabel(table.name),
      rowCount: this.getTableRowCount(table.name),
      sql: table.sql
    }))
  }

  /**
   * 查询指定数据库表的字段结构。
   *
   * 复用 EnhancedDatabase.getTableSchema()，
   * 然后补充中文字段名称。
   */
  getDatabaseTableSchema(tableName: string): DatabaseColumnInfo[] {
    const safeTableName = this.resolveTableName(tableName)

    const rows = this.getTableSchema(safeTableName)

    return rows.map((row) => ({
      cid: row.cid,
      name: row.name,
      label: this.getDatabaseColumnLabel(safeTableName, row.name),
      type: row.type,
      notNull: row.notNull === 1,
      defaultValue: row.defaultValue,
      primaryKey: row.primaryKey > 0
    }))
  }

  /**
   * 分页读取指定数据库表的数据。
   *
   * 复用 EnhancedDatabase：
   * - resolveTableName()；
   * - normalizePositiveInteger()；
   * - getTableRowCount()；
   * - getTableData()。
   *
   * page 最小为 1；
   * pageSize 被限制在 1 到 200 之间。
   */
  getDatabaseTableData(tableName: string, page = 1, pageSize = 50): DatabaseTableData {
    const safeTableName = this.resolveTableName(tableName)

    const safePage = this.normalizePositiveInteger(page, 1, Number.MAX_SAFE_INTEGER)

    const safePageSize = this.normalizePositiveInteger(pageSize, 50, 200)

    const total = this.getTableRowCount(safeTableName)

    const rawRows = this.getTableData(safeTableName, safePage, safePageSize)

    /**
     * 将不能直接通过 IPC 传递的数据转换为安全格式。
     */
    const rows = rawRows.map((row) => this.serializeDatabaseRow(row))

    return {
      tableName: safeTableName,
      tableLabel: this.getDatabaseTableLabel(safeTableName),
      columns: this.getDatabaseTableSchema(safeTableName),
      rows,
      displayRows: rows.map((row) => this.toDatabaseDisplayRow(safeTableName, row)),
      page: safePage,
      pageSize: safePageSize,
      total,
      pageCount: Math.ceil(total / safePageSize)
    }
  }

  /**
   * 获取数据库表的中文名称。
   *
   * 未配置中文名称时返回数据库真实表名。
   */
  private getDatabaseTableLabel(tableName: string): string {
    return DATABASE_TABLE_LABELS[tableName] ?? tableName
  }

  /**
   * 获取数据库字段的中文名称。
   *
   * 未配置中文名称时返回数据库真实字段名。
   */
  private getDatabaseColumnLabel(tableName: string, columnName: string): string {
    return DATABASE_COLUMN_LABELS[tableName]?.[columnName] ?? columnName
  }

  /**
   * 将一行 SQLite 原始数据转换为中文字段展示数据。
   */
  private toDatabaseDisplayRow(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(row).map(([columnName, value]) => [this.getDatabaseColumnLabel(tableName, columnName), value]))
  }

  /**
   * 将 SQLite 特殊值转换为适合通过 IPC 展示的数据。
   *
   * - BLOB：只返回数据大小；
   * - BigInt：转换成字符串；
   * - 其他数据：保持原值。
   */
  private serializeDatabaseRow(row: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (Buffer.isBuffer(value)) {
          return [key, `[BLOB ${value.byteLength} bytes]`]
        }

        if (typeof value === "bigint") {
          return [key, value.toString()]
        }

        return [key, value]
      })
    )
  }

  /**
   * 读取一项通用应用状态。
   *
   * key 不存在时返回 null；
   * 存在时将 JSON 字符串反序列化。
   */
  getState<T>(key: string): T | null {
    const row = this.database
      .prepare(
        `
        SELECT value_json
        FROM app_state
        WHERE key = ?
      `
      )
      .get(key) as
      | {
          value_json: string
        }
      | undefined

    if (!row) {
      return null
    }

    return JSON.parse(row.value_json) as T
  }

  /**
   * 新增或覆盖一项通用应用状态。
   */
  setState(key: string, value: unknown): void {
    const valueJson = JSON.stringify(value)

    /**
     * JSON.stringify(undefined) 的结果是 undefined，
     * 无法作为有效 JSON 保存。
     */
    if (valueJson === undefined) {
      throw new TypeError("app_state 不支持保存 undefined")
    }

    const now = new Date().toISOString()

    this.database
      .prepare(
        `
        INSERT INTO app_state (
          key,
          value_json,
          device_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          device_id = excluded.device_id,
          updated_at = excluded.updated_at
      `
      )
      .run(key, valueJson, this.deviceId, now, now)
  }

  /**
   * 删除指定的通用应用状态。
   *
   * 返回值表示数据库中是否实际删除了一条记录。
   */
  deleteState(key: string): boolean {
    const result = this.database
      .prepare(
        `
        DELETE FROM app_state
        WHERE key = ?
      `
      )
      .run(key)

    return result.changes > 0
  }

  /**
   * 获取数据库调试信息。
   *
   * 不直接向渲染进程暴露 better-sqlite3 实例。
   */
  getInfo(): {
    databasePath: string
    databaseVersion: number
    deviceId: string
    sessionId: string
  } {
    return {
      databasePath: this.databasePath,
      databaseVersion: DATABASE_VERSION,
      deviceId: this.deviceId,
      sessionId: this.sessionId
    }
  }

  /**
   * 正常结束当前应用会话并关闭数据库连接。
   *
   * 该方法允许重复调用，
   * 第二次及之后会直接返回。
   */
  override close(): void {
    if (this.closed) {
      return
    }

    /**
     * 关闭连接前记录本次应用会话结束时间。
     */
    if (this.database.open) {
      this.database
        .prepare(
          `
          UPDATE app_sessions
          SET ended_at = ?
          WHERE id = ?
        `
        )
        .run(new Date().toISOString(), this.sessionId)
    }

    /**
     * 由 EnhancedDatabase 统一关闭连接。
     */
    super.close()

    this.closed = true
  }
}
