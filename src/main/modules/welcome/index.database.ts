import { app } from "electron"
import Database from "better-sqlite3"
import { randomUUID } from "crypto"
import { existsSync, mkdirSync } from "fs"
import { arch, cpus, hostname, platform, release, totalmem, type, version } from "os"
import { dirname, join, normalize, resolve } from "path"
import type { WorkspaceDataInput, PersistedWorkspaceData, RecentWorkspace, WorkspaceOpenRecord, DeviceInfo, WorkspaceRow, DatabaseColumnInfo, DatabaseTableData, DatabaseTableInfo } from "./index.type"

/**
 * 当前数据库结构版本。
 * 后续调整表结构时递增该值，并在 migrate 中增加对应的迁移步骤。
 */
const DATABASE_VERSION = 2

/** DevTools 中使用的数据库表中文名称，不影响真实 SQLite 表名。 */
const DATABASE_TABLE_LABELS: Record<string, string> = {
  app_metadata: "应用元数据",
  devices: "设备信息",
  app_sessions: "应用会话",
  workspaces: "工作区",
  workspace_open_records: "工作区打开记录",
  app_state: "应用状态"
}

/** DevTools 中使用的字段中文名称，不影响真实 SQLite 字段名。 */
const DATABASE_COLUMN_LABELS: Record<string, Record<string, string>> = {
  app_metadata: {
    key: "键",
    value: "值",
    updated_at: "更新时间"
  },
  devices: {
    id: "设备ID",
    hostname: "主机名",
    platform: "系统平台",
    arch: "系统架构",
    os_type: "操作系统类型",
    os_release: "操作系统发行版本",
    os_version: "操作系统版本",
    cpu_model: "CPU型号",
    cpu_count: "CPU核心数",
    total_memory: "总内存（字节）",
    locale: "语言区域",
    timezone: "时区",
    app_version: "应用版本",
    electron_version: "Electron版本",
    node_version: "Node.js版本",
    first_seen_at: "首次识别时间",
    last_seen_at: "最后识别时间"
  },
  app_sessions: {
    id: "会话ID",
    device_id: "设备ID",
    started_at: "启动时间",
    ended_at: "结束时间",
    app_version: "应用版本",
    electron_version: "Electron版本",
    node_version: "Node.js版本",
    platform: "系统平台",
    arch: "系统架构"
  },
  workspaces: {
    id: "工作区ID",
    name: "工作区名称",
    path: "工作区路径",
    normalized_path: "规范化路径",
    file_count: "文件数量",
    first_opened_at: "首次打开时间",
    last_opened_at: "最后打开时间",
    open_count: "打开次数",
    is_available: "路径是否可用",
    last_device_id: "最后打开设备ID",
    created_at: "创建时间",
    updated_at: "更新时间"
  },
  workspace_open_records: {
    id: "打开记录ID",
    workspace_id: "工作区ID",
    device_id: "设备ID",
    session_id: "会话ID",
    path: "工作区路径",
    file_count: "文件数量",
    opened_at: "打开时间",
    hostname: "主机名",
    os_type: "操作系统类型",
    os_release: "操作系统发行版本",
    os_version: "操作系统版本",
    cpu_model: "CPU型号",
    cpu_count: "CPU核心数",
    total_memory: "总内存（字节）",
    locale: "语言区域",
    timezone: "时区",
    app_version: "应用版本",
    electron_version: "Electron版本",
    node_version: "Node.js版本",
    platform: "系统平台",
    arch: "系统架构"
  },
  app_state: {
    key: "状态键",
    value_json: "状态值",
    device_id: "设备ID",
    created_at: "创建时间",
    updated_at: "更新时间"
  }
}

/**
 * Vessel 本地数据库管理器。
 *
 * 该类只在 Electron 主进程中创建，负责：
 * 1. 初始化和迁移 SQLite 数据库；
 * 2. 维护设备与应用会话信息；
 * 3. 保存工作区及其每次打开记录；
 * 4. 提供通用 JSON 状态的持久化能力。
 */
export class AppDatabase {
  /** better-sqlite3 数据库连接实例。 */
  private readonly database: Database.Database

  /** vessel.db 在当前设备上的绝对路径。 */
  private readonly databasePath: string

  /** 当前设备的持久化 ID，同一份 userData 下不会随应用重启变化。 */
  private readonly deviceId: string

  /** 本次应用运行的会话 ID，每次启动都会重新生成。 */
  private readonly sessionId = randomUUID()

  /** 防止数据库连接被重复关闭。 */
  private closed = false

  constructor() {
    // 数据库统一放在 Electron 的 userData 目录，不能放到用户选择的工作区内。
    this.databasePath = join(app.getPath("userData"), "vessel.db")

    // 首次运行时 userData 目录可能尚未创建。
    mkdirSync(dirname(this.databasePath), { recursive: true })

    // 打开数据库后先完成连接配置和表结构迁移，再创建本次设备与会话记录。
    this.database = new Database(this.databasePath)
    this.configure()
    this.migrate()

    this.deviceId = this.resolveDeviceId()
    this.upsertCurrentDevice()
    this.startSession()
  }

  /** 配置 SQLite 连接级参数。 */
  private configure(): void {
    // WAL 提升读写并发能力，适合桌面应用频繁读取、少量写入的场景。
    this.database.pragma("journal_mode = WAL")

    // 启用外键约束，保证工作区记录、设备和会话之间的数据关系有效。
    this.database.pragma("foreign_keys = ON")

    // NORMAL 在安全性和本地写入性能之间取得平衡。
    this.database.pragma("synchronous = NORMAL")

    // 数据库被短暂占用时最多等待 5 秒，避免立即抛出 SQLITE_BUSY。
    this.database.pragma("busy_timeout = 5000")
  }

  /** 创建初始表结构，并通过 user_version 管理数据库版本。 */
  private migrate(): void {
    let currentVersion = this.database.pragma("user_version", {
      simple: true
    }) as number

    if (currentVersion > DATABASE_VERSION) {
      // 防止旧版应用错误打开由新版应用创建的数据库。
      throw new Error(`数据库版本 ${currentVersion} 高于当前应用支持的版本 ${DATABASE_VERSION}`)
    }

    if (currentVersion < 1) {
      // 所有建表语句放在同一个事务中，任何一步失败都会整体回滚。
      this.database.transaction(() => {
        this.database.exec(`
          -- 应用内部元数据，目前用于保存不会随应用重启变化的设备 ID。
          CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          -- 当前设备的软硬件环境以及应用运行版本。
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

          -- 每次启动应用都会创建一条会话，退出时补充 ended_at。
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

          -- 工作区汇总表，同一路径只保留一条并累计打开次数。
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

          -- 工作区打开明细表，每次打开都会追加新记录。
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
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
            FOREIGN KEY (device_id) REFERENCES devices(id),
            FOREIGN KEY (session_id) REFERENCES app_sessions(id)
          );

          -- 通用状态表，用于保存主题、布局、编辑器设置等 JSON 数据。
          CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            device_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (device_id) REFERENCES devices(id)
          );

          -- 最近工作区及打开历史的常用查询索引。
          CREATE INDEX IF NOT EXISTS idx_workspaces_last_opened_at
            ON workspaces(last_opened_at DESC);
          CREATE INDEX IF NOT EXISTS idx_workspace_open_records_workspace_id
            ON workspace_open_records(workspace_id, opened_at DESC);
          CREATE INDEX IF NOT EXISTS idx_workspace_open_records_device_id
            ON workspace_open_records(device_id, opened_at DESC);
        `)

        // 这里只创建 v1 表结构，不能直接写入最新版本号。
        this.database.pragma("user_version = 1")
      })()

      currentVersion = 1
    }

    if (currentVersion < 2) {
      // v2：为每次工作区打开记录补充完整的设备和运行时快照。
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

          -- v1 已有记录只能使用关联设备当前保存的信息进行回填。
          UPDATE workspace_open_records
          SET
            hostname = COALESCE((
              SELECT devices.hostname
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 'unknown'),
            os_type = COALESCE((
              SELECT devices.os_type
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 'unknown'),
            os_release = COALESCE((
              SELECT devices.os_release
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 'unknown'),
            os_version = COALESCE((
              SELECT devices.os_version
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 'unknown'),
            cpu_model = COALESCE((
              SELECT devices.cpu_model
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 'unknown'),
            cpu_count = COALESCE((
              SELECT devices.cpu_count
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 0),
            total_memory = COALESCE((
              SELECT devices.total_memory
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 0),
            locale = COALESCE((
              SELECT devices.locale
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 'unknown'),
            timezone = COALESCE((
              SELECT devices.timezone
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 'unknown'),
            node_version = COALESCE((
              SELECT devices.node_version
              FROM devices
              WHERE devices.id = workspace_open_records.device_id
            ), 'unknown');
        `)

        this.database.pragma("user_version = 2")
      })()
    }
  }

  /**
   * 获取当前设备的持久化 ID。
   * 第一次运行时生成 UUID，之后始终从 app_metadata 中读取。
   */
  private resolveDeviceId(): string {
    const row = this.database.prepare("SELECT value FROM app_metadata WHERE key = ?").get("device.id") as { value: string } | undefined

    // 已经存在时直接复用，确保同一设备上的打开历史能够关联起来。
    if (row?.value) return row.value

    // 首次运行时生成并立即写入数据库。
    const deviceId = randomUUID()
    const now = new Date().toISOString()

    this.database.prepare("INSERT INTO app_metadata (key, value, updated_at) VALUES (?, ?, ?)").run("device.id", deviceId, now)

    return deviceId
  }

  /** 收集当前设备和应用环境中可能变化的信息。 */
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
   * first_seen_at 只在首次插入时保存，后续启动仅更新 last_seen_at 等可变信息。
   */
  private upsertCurrentDevice(): void {
    const now = new Date().toISOString()
    const device = this.getCurrentDeviceValues(now)

    this.database
      .prepare(
        `
        INSERT INTO devices (
          id, hostname, platform, arch, os_type, os_release, os_version,
          cpu_model, cpu_count, total_memory, locale, timezone, app_version,
          electron_version, node_version, first_seen_at, last_seen_at
        ) VALUES (
          @id, @hostname, @platform, @arch, @osType, @osRelease, @osVersion,
          @cpuModel, @cpuCount, @totalMemory, @locale, @timezone, @appVersion,
          @electronVersion, @nodeVersion, @firstSeenAt, @lastSeenAt
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

  /** 创建本次应用启动会话，ended_at 会在 close 中补充。 */
  private startSession(): void {
    const now = new Date().toISOString()

    this.database
      .prepare(
        `
        INSERT INTO app_sessions (
          id, device_id, started_at, app_version, electron_version,
          node_version, platform, arch
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(this.sessionId, this.deviceId, now, app.getVersion(), process.versions.electron ?? "unknown", process.versions.node, platform(), arch())
  }

  /**
   * 生成用于判断工作区是否相同的规范路径。
   * Windows 路径不区分大小写，因此额外转换为小写。
   */
  private normalizeWorkspacePath(workspacePath: string): string {
    const normalizedPath = normalize(resolve(workspacePath))
    return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath
  }

  /**
   * 保存一次工作区打开操作。
   *
   * 同一个事务内同时完成：
   * 1. 新增或更新工作区汇总信息；
   * 2. 查询更新后的工作区主键和累计次数；
   * 3. 追加一条不会被覆盖的打开历史。
   */
  recordWorkspaceOpened(workspace: WorkspaceDataInput): PersistedWorkspaceData {
    const openedAt = new Date().toISOString()
    const normalizedPath = this.normalizeWorkspacePath(workspace.path)
    const isAvailable = existsSync(workspace.path) ? 1 : 0
    const fileCount = workspace.files.length

    // 读取当前设备快照，写入打开明细后不会再受 devices 表后续更新影响。
    const device = this.getCurrentDevice()

    const transaction = this.database.transaction(() => {
      // normalized_path 唯一：首次打开时新增，再次打开时刷新信息并累加 open_count。
      this.database
        .prepare(
          `
          INSERT INTO workspaces (
            name, path, normalized_path, file_count, first_opened_at,
            last_opened_at, open_count, is_available, last_device_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
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

      // 查询 UPSERT 后的最终数据，用于创建明细记录并返回给渲染进程。
      const savedWorkspace = this.database
        .prepare(
          `
          SELECT
            id, name, path, file_count, first_opened_at, last_opened_at,
            open_count, is_available, last_device_id
          FROM workspaces
          WHERE normalized_path = ?
        `
        )
        .get(normalizedPath) as WorkspaceRow

      // 汇总表会更新，但明细表始终 INSERT，从而保留每一次打开行为。
      this.database
        .prepare(
          `
          INSERT INTO workspace_open_records (
            workspace_id, device_id, session_id, path, file_count, opened_at,
            hostname, os_type, os_release, os_version, cpu_model, cpu_count,
            total_memory, locale, timezone, app_version, electron_version,
            node_version, platform, arch
          ) VALUES (
            @workspaceId, @deviceId, @sessionId, @path, @fileCount, @openedAt,
            @hostname, @osType, @osRelease, @osVersion, @cpuModel, @cpuCount,
            @totalMemory, @locale, @timezone, @appVersion, @electronVersion,
            @nodeVersion, @platform, @arch
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

    // better-sqlite3 的 transaction 返回可执行函数，此处才真正开始事务。
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

  /** 查询最近打开的工作区，limit 被限制在 1 到 100 之间。 */
  getRecentWorkspaces(limit = 10): RecentWorkspace[] {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
    const rows = this.database
      .prepare(
        `
        SELECT
          id, name, path, file_count, first_opened_at, last_opened_at,
          open_count, is_available, last_device_id
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
      // 实时检查目录是否仍然存在，不依赖数据库中的历史状态。
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
   * limit 最终会被限制在 1 到 500 之间，
   * 防止渲染进程一次读取过多历史记录。
   */
  getWorkspaceOpenRecords(workspaceId: number, limit = 100): WorkspaceOpenRecord[] {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500)

    // 使用 AS 将数据库的 snake_case 字段直接转换为渲染进程需要的 camelCase。
    // 查询结果已经满足 WorkspaceOpenRecord，因此不再需要额外执行 map。
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

  /** 获取数据库中保存的当前设备信息。 */
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
   * 查询数据库中的业务表。
   *
   * 默认排除 sqlite_ 开头的 SQLite 内部表，避免调试接口依赖内部实现。
   * 该方法只读取数据，不允许通过 DevTools 执行任意 SQL。
   */
  getDatabaseTables(): DatabaseTableInfo[] {
    const tables = this.database
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
      .all() as Array<{ name: string; sql: string | null }>

    return tables.map((table) => {
      const quotedTableName = this.quoteIdentifier(table.name)
      const countRow = this.database.prepare(`SELECT COUNT(*) AS count FROM ${quotedTableName}`).get() as { count: number }

      return {
        name: table.name,
        label: this.getDatabaseTableLabel(table.name),
        rowCount: countRow.count,
        sql: table.sql
      }
    })
  }

  /** 查询指定数据库表的字段结构。 */
  getDatabaseTableSchema(tableName: string): DatabaseColumnInfo[] {
    const safeTableName = this.resolveDatabaseTableName(tableName)
    const rows = this.database
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
   * page 最小为 1；pageSize 被限制在 1 到 200 之间，
   * 避免在 DevTools 中一次加载过多数据阻塞主进程。
   */
  getDatabaseTableData(tableName: string, page = 1, pageSize = 50): DatabaseTableData {
    const safeTableName = this.resolveDatabaseTableName(tableName)
    const safePage = this.normalizePositiveInteger(page, 1, Number.MAX_SAFE_INTEGER)
    const safePageSize = this.normalizePositiveInteger(pageSize, 50, 200)
    const offset = (safePage - 1) * safePageSize
    const quotedTableName = this.quoteIdentifier(safeTableName)

    const countRow = this.database.prepare(`SELECT COUNT(*) AS count FROM ${quotedTableName}`).get() as { count: number }
    const rawRows = this.database.prepare(`SELECT * FROM ${quotedTableName} LIMIT ? OFFSET ?`).all(safePageSize, offset) as Record<string, unknown>[]

    const rows = rawRows.map((row) => this.serializeDatabaseRow(row))

    return {
      tableName: safeTableName,
      tableLabel: this.getDatabaseTableLabel(safeTableName),
      columns: this.getDatabaseTableSchema(safeTableName),
      rows,
      displayRows: rows.map((row) => this.toDatabaseDisplayRow(safeTableName, row)),
      page: safePage,
      pageSize: safePageSize,
      total: countRow.count,
      pageCount: Math.ceil(countRow.count / safePageSize)
    }
  }

  /**
   * 校验表名是否来自当前数据库。
   * 动态 SQL 无法通过 ? 绑定表名，因此必须先执行白名单查询。
   */
  private resolveDatabaseTableName(tableName: string): string {
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
      .get(tableName) as { name: string } | undefined

    if (!row) {
      throw new Error(`数据库表不存在或不允许访问：${tableName}`)
    }

    return row.name
  }

  /** 将经过白名单校验的 SQLite 标识符安全包裹在双引号中。 */
  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  /** 获取数据库表的中文名称；未配置时退回真实表名。 */
  private getDatabaseTableLabel(tableName: string): string {
    return DATABASE_TABLE_LABELS[tableName] ?? tableName
  }

  /** 获取数据库字段的中文名称；未配置时退回真实字段名。 */
  private getDatabaseColumnLabel(tableName: string, columnName: string): string {
    return DATABASE_COLUMN_LABELS[tableName]?.[columnName] ?? columnName
  }

  /** 将一行原始 SQLite 数据转换为适合 DevTools 展示的中文字段数据。 */
  private toDatabaseDisplayRow(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(row).map(([columnName, value]) => [this.getDatabaseColumnLabel(tableName, columnName), value]))
  }

  /** 将分页参数规范为指定范围内的正整数。 */
  private normalizePositiveInteger(value: number, fallback: number, maximum: number): number {
    const normalizedValue = Number.isFinite(value) ? Math.trunc(value) : fallback
    return Math.min(Math.max(normalizedValue, 1), maximum)
  }

  /**
   * 将 SQLite 特殊值转换为适合通过 IPC 展示的数据。
   * BLOB 只显示大小，BigInt 使用字符串表示，避免序列化失败或数据量过大。
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
   * 读取通用应用状态。
   * key 不存在时返回 null，存在时将 JSON 字符串反序列化为调用方指定的类型。
   */
  getState<T>(key: string): T | null {
    const row = this.database.prepare("SELECT value_json FROM app_state WHERE key = ?").get(key) as { value_json: string } | undefined

    if (!row) return null
    return JSON.parse(row.value_json) as T
  }

  /** 新增或覆盖一项通用应用状态。 */
  setState(key: string, value: unknown): void {
    const valueJson = JSON.stringify(value)

    // JSON.stringify(undefined) 的结果仍是 undefined，无法作为有效 JSON 保存。
    if (valueJson === undefined) {
      throw new TypeError("app_state 不支持保存 undefined")
    }

    const now = new Date().toISOString()
    this.database
      .prepare(
        `
        INSERT INTO app_state (key, value_json, device_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          device_id = excluded.device_id,
          updated_at = excluded.updated_at
      `
      )
      .run(key, valueJson, this.deviceId, now, now)
  }

  /** 删除指定状态，返回值表示数据库中是否确实删除了一条记录。 */
  deleteState(key: string): boolean {
    return this.database.prepare("DELETE FROM app_state WHERE key = ?").run(key).changes > 0
  }

  /** 获取数据库调试信息，不直接暴露 better-sqlite3 实例。 */
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
   * 该方法允许重复调用，第二次及之后会直接返回。
   */
  close(): void {
    if (this.closed) return

    // 退出前记录会话结束时间，便于后续统计一次应用运行了多久。
    this.database.prepare("UPDATE app_sessions SET ended_at = ? WHERE id = ?").run(new Date().toISOString(), this.sessionId)
    this.database.close()
    this.closed = true
  }
}
