import { app } from "electron"
import { randomUUID } from "crypto"
import { existsSync, mkdirSync } from "fs"
import { arch, cpus, hostname, platform, release, totalmem, type, version } from "os"
import { dirname, join, normalize, resolve } from "path"
import { DATABASE_COLUMN_LABELS, DATABASE_TABLE_LABELS } from "@main/modules/welcome/constants/index.constant"
import { AppDatabase as BaseAppDatabase } from "@main/database/app-database"
import type { DatabaseColumnInfo, DatabaseTableData, DatabaseTableInfo, DeviceInfo, PersistedWorkspaceData, RecentWorkspace, WorkspaceDataInput, WorkspaceOpenRecord, WorkspaceRow } from "@main/modules/welcome/index.type"

/**
 * @description Vessel 业务数据库。
 *
 * 继承 BaseAppDatabase，在基础数据库连接、SQLite 配置、
 * 数据库迁移以及 Repository 能力之上扩展 Vessel 业务数据能力。
 *
 * 当前类主要负责：
 * - 管理当前设备的持久化身份及设备信息；
 * - 记录每次应用启动产生的运行会话；
 * - 记录工作区打开信息及历史明细；
 * - 提供数据库表、字段和数据调试能力；
 * - 在应用退出时正确结束会话并关闭数据库连接。
 *
 * 基础数据库职责由 BaseAppDatabase 提供，
 * 当前类只负责 Vessel 业务层数据库能力。
 */
export class AppDatabase extends BaseAppDatabase {
  /**
   * @description vessel.db 在当前设备上的绝对路径。
   *
   * 数据库文件位于 Electron userData 目录中。
   */
  private readonly databasePath: string

  /**
   * @description 当前设备的持久化 ID。
   *
   * 首次运行时生成 UUID 并保存到 app_metadata，
   * 同一份 Electron userData 下不会随应用重启变化。
   */
  private readonly deviceId: string

  /**
   * @description 本次应用运行的会话 ID。
   *
   * 每次启动应用都会重新生成，
   * 用于关联当前运行周期产生的业务记录。
   */
  private readonly sessionId = randomUUID()

  /**
   * @description 数据库连接是否已经完成关闭。
   *
   * 用于保证 close() 可以安全重复调用，
   * 防止重复结束会话或重复关闭数据库连接。
   */
  private closed = false

  /**
   * @description 创建 Vessel 业务数据库。
   *
   * 初始化顺序：
   * 1. 计算 vessel.db 数据库文件路径；
   * 2. 确保数据库目录存在；
   * 3. 调用 BaseAppDatabase 完成数据库连接、配置、迁移和 Repository 创建；
   * 4. 获取当前设备持久化 ID；
   * 5. 新增或刷新当前设备信息；
   * 6. 创建本次应用运行会话。
   */
  constructor() {
    const databasePath = join(app.getPath("userData"), "vessel.db")

    /**
     * 首次运行时 userData 目录可能尚未创建。
     */
    mkdirSync(dirname(databasePath), {
      recursive: true
    })

    /**
     * 调用 BaseAppDatabase 构造函数。
     *
     * 父类构造函数负责：
     * 1. 创建 better-sqlite3 连接；
     * 2. 配置 SQLite；
     * 3. 执行数据库迁移；
     * 4. 创建 Repository。
     */
    super(databasePath)
    this.databasePath = databasePath
    this.deviceId = this.resolveDeviceId()
    this.upsertCurrentDevice()
    this.startSession()
  }

  /**
   * @description 获取当前设备的持久化 ID。
   *
   * 优先从 app_metadata 中读取 device.id。
   * 当 device.id 不存在时生成新的 UUID 并持久化，
   * 后续应用启动继续复用该 ID。
   *
   * @returns 当前设备持久化 ID。
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

    if (row?.value) {
      return row.value
    }

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
   * @description 收集当前设备和应用运行环境中的可变信息。
   *
   * 包括主机、操作系统、CPU、内存、语言、时区以及
   * Vessel、Electron、Node.js 等版本信息。
   *
   * @param now 当前采集时间，使用 ISO 8601 字符串。
   * @returns 当前设备和应用环境信息，不包含设备 ID 与首次发现时间。
   */
  private getCurrentDeviceValues(now: string): Omit<DeviceInfo, "id" | "firstSeenAt"> {
    const cpuList = cpus()

    return {
      // 电脑主机名
      hostname: hostname(),
      // Node 识别的平台，例如 win32、darwin、linux
      platform: platform(),
      // CPU 架构，例如 x64、arm64
      arch: arch(),
      // 操作系统类型，例如 Windows_NT、Darwin、Linux
      osType: type(),
      // 操作系统内核/发行版本
      osRelease: release(),
      // 更详细的操作系统版本描述
      osVersion: version(),
      // CPU 型号
      cpuModel: cpuList[0]?.model ?? "unknown",
      // 逻辑 CPU 核心数
      cpuCount: cpuList.length,
      // 设备总内存，单位是 字节
      totalMemory: totalmem(),
      // Electron 当前语言，例如 zh-CN
      locale: app.getLocale(),
      // 当前系统时区，例如 Asia/Shanghai
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      // Vessel 当前应用版本
      appVersion: app.getVersion(),
      // Electron 版本
      electronVersion: process.versions.electron ?? "unknown",
      // Node.js 版本
      nodeVersion: process.versions.node,
      // 本次采集设备信息的时间
      lastSeenAt: now
    }
  }

  /**
   * @description 新增或刷新当前设备信息。
   *
   * 当前设备首次出现时写入完整信息及 first_seen_at；
   * 后续启动通过设备 ID 更新可变信息和 last_seen_at，
   * first_seen_at 保持首次记录时间不变。
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
   * @description 创建本次应用启动会话。
   *
   * 将当前设备、应用版本、运行时版本以及平台信息写入 app_sessions。
   * ended_at 在 close() 中补充，用于表示本次应用会话的实际结束时间。
   */
  private startSession(): void {
    const now = new Date().toISOString()
    console.log("now", now)

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
   * @description 生成用于判断工作区唯一性的规范路径。
   *
   * 路径会先经过 resolve() 和 normalize() 处理。
   * Windows 文件系统通常不区分大小写，
   * 因此 Windows 平台下额外转换为小写。
   *
   * @param workspacePath 工作区原始路径。
   * @returns 规范化后的工作区路径。
   */
  private normalizeWorkspacePath(workspacePath: string): string {
    const normalizedPath = normalize(resolve(workspacePath))

    return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath
  }

  /**
   * @description 保存一次工作区打开操作。
   *
   * 同一个事务内完成：
   * 1. 新增或更新 workspaces 工作区汇总信息；
   * 2. 查询 UPSERT 后的工作区主键及累计打开次数；
   * 3. 向 workspace_open_records 追加一条不会被覆盖的打开历史。
   *
   * 打开明细同时保存当前设备快照，
   * 避免 devices 表后续变化影响历史记录。
   *
   * @param workspace 当前打开的工作区数据。
   * @returns 已补充数据库主键、设备、会话、打开时间和累计次数的工作区数据。
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
   * @description 查询最近打开的工作区。
   *
   * 按 last_opened_at 倒序返回，
   * 并实时通过文件系统检查工作区目录是否仍然存在。
   *
   * limit 被限制在 1 到 100 之间。
   *
   * @param limit 最大返回数量，默认 10。
   * @returns 最近打开的工作区列表。
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
   * @description 查询指定工作区的打开历史明细。
   *
   * 每条记录包含打开时保存的工作区、设备、系统、
   * 硬件以及应用运行环境快照。
   *
   * limit 被限制在 1 到 500 之间。
   *
   * @param workspaceId 工作区数据库主键。
   * @param limit 最大返回数量，默认 100。
   * @returns 工作区打开历史列表，按 opened_at 倒序排列。
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
   * @description 获取数据库中保存的当前设备信息。
   *
   * 根据当前实例持有的 deviceId 查询 devices 表。
   *
   * @returns 当前设备完整信息。
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
   * @description 查询数据库中的所有业务表。
   *
   * 复用 EnhancedDatabase.getTables() 获取基础表信息，
   * 并补充中文表名以及当前表的数据总数。
   *
   * @returns 数据库业务表信息列表。
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
   * @description 查询指定数据库表的字段结构。
   *
   * 复用 EnhancedDatabase.getTableSchema() 获取 SQLite 字段信息，
   * 并补充中文字段名称，同时将 notNull 和 primaryKey
   * 转换为更适合业务层使用的布尔值。
   *
   * @param tableName 数据库表名。
   * @returns 数据库字段结构列表。
   * @throws 当表名非法、表不存在或不允许访问时抛出异常。
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
   * @description 分页读取指定数据库表的数据。
   *
   * 复用 EnhancedDatabase 提供的表名校验、分页参数规范化、
   * 数据总数统计以及分页查询能力。
   *
   * 查询结果会额外补充中文表名、字段结构、中文字段名称，
   * 并将 SQLite 特殊值转换为适合 IPC 传输的格式。
   *
   * page 最小为 1，
   * pageSize 被限制在 1 到 200 之间。
   *
   * @param tableName 数据库表名。
   * @param page 当前页码，默认 1。
   * @param pageSize 每页数据数量，默认 50。
   * @returns 当前表的分页数据及分页信息。
   * @throws 当表名非法、表不存在或不允许访问时抛出异常。
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
   * @description 获取数据库表的中文名称。
   *
   * 优先读取 DATABASE_TABLE_LABELS 中配置的中文名称，
   * 未配置时返回数据库真实表名。
   *
   * @param tableName 数据库表名。
   * @returns 数据库表展示名称。
   */
  private getDatabaseTableLabel(tableName: string): string {
    return DATABASE_TABLE_LABELS[tableName] ?? tableName
  }

  /**
   * @description 获取数据库字段的中文名称。
   *
   * 优先读取 DATABASE_COLUMN_LABELS 中配置的中文名称，
   * 未配置时返回数据库真实字段名。
   *
   * @param tableName 数据库表名。
   * @param columnName 数据库字段名。
   * @returns 数据库字段展示名称。
   */
  private getDatabaseColumnLabel(tableName: string, columnName: string): string {
    return DATABASE_COLUMN_LABELS[tableName]?.[columnName] ?? columnName
  }

  /**
   * @description 将一行数据库数据转换为中文字段展示数据。
   *
   * 仅转换对象键名，字段值保持原样。
   *
   * @param tableName 数据库表名。
   * @param row 已序列化的数据库原始行数据。
   * @returns 使用中文字段名称作为键的展示数据。
   */
  private toDatabaseDisplayRow(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(row).map(([columnName, value]) => [this.getDatabaseColumnLabel(tableName, columnName), value]))
  }

  /**
   * @description 将 SQLite 特殊值转换为适合通过 IPC 传输和展示的数据。
   *
   * 转换规则：
   * - BLOB：转换为包含字节大小的描述字符串；
   * - BigInt：转换为字符串；
   * - 其他数据：保持原值。
   *
   * @param row SQLite 原始行数据。
   * @returns IPC 安全的数据库行数据。
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
   * @description 读取一项通用应用状态。
   *
   * 根据 key 查询 app_state。
   * key 不存在时返回 null，
   * 存在时将 value_json 反序列化为指定类型。
   *
   * @typeParam T 应用状态反序列化后的数据类型。
   * @param key 应用状态键。
   * @returns 应用状态值；不存在时返回 null。
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
   * @description 新增或覆盖一项通用应用状态。
   *
   * value 会通过 JSON.stringify() 序列化后写入 app_state。
   * key 已存在时更新状态值、设备 ID 和更新时间，
   * 不覆盖原 created_at。
   *
   * @param key 应用状态键。
   * @param value 需要保存的应用状态值。
   * @throws 当 value 无法序列化为有效 JSON 字符串时抛出 TypeError。
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
   * @description 删除指定的通用应用状态。
   *
   * @param key 需要删除的应用状态键。
   * @returns 是否实际删除了数据库中的记录。
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
   * @description 获取当前数据库调试信息。
   *
   * 只返回调试所需的基础信息，
   * 不直接向渲染进程暴露 better-sqlite3 实例。
   *
   * @returns 数据库路径、结构版本、当前设备 ID 和当前会话 ID。
   */
  getInfo(): {
    databasePath: string
    databaseVersion: number
    deviceId: string
    sessionId: string
  } {
    return {
      databasePath: this.databasePath,

      /**
       * 使用父类提供的方法获取实际的
       * SQLite user_version。
       */
      databaseVersion: this.getVersion(),

      deviceId: this.deviceId,
      sessionId: this.sessionId
    }
  }

  /**
   * @description 正常结束当前应用会话并关闭数据库连接。
   *
   * 数据库仍处于打开状态时，
   * 先更新当前 app_sessions 记录的 ended_at，
   * 再调用父类 close() 统一关闭 better-sqlite3 连接。
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
     * 交给父类统一关闭数据库连接。
     */
    super.close()

    this.closed = true
  }
}
