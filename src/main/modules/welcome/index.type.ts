/**
 * 工作区中受支持的文件信息。
 *
 * 由目录扫描模块生成，最终会随工作区数据传递给渲染进程。
 */
export interface WorkspaceFile {
  /** 文件名称，包含扩展名，例如 note.md。 */
  name: string

  /** 文件在当前设备上的绝对路径。 */
  path: string
}

/**
 * 从目录选择模块传入的原始工作区数据。
 *
 * 此时工作区尚未写入数据库，因此不包含：
 * - 数据库主键；
 * - 设备 ID；
 * - 会话 ID；
 * - 打开时间和打开次数。
 */
export interface WorkspaceDataInput {
  /** 工作区名称，通常使用所选文件夹的名称。 */
  name: string

  /** 工作区文件夹在当前设备上的绝对路径。 */
  path: string

  /** 工作区内扫描到的受支持文件。 */
  files: WorkspaceFile[]
}

/**
 * 工作区写入数据库后返回给渲染进程的完整数据。
 *
 * 在 WorkspaceDataInput 基础上补充数据库主键、
 * 当前设备、应用会话以及打开记录等持久化信息。
 */
export interface PersistedWorkspaceData extends WorkspaceDataInput {
  /** workspaces 表中的自增主键。 */
  id: number

  /** 当前设备的持久化 ID。 */
  deviceId: string

  /** 本次应用启动生成的会话 ID。 */
  sessionId: string

  /** 工作区首次打开时间，使用 ISO 8601 格式。 */
  firstOpenedAt: string

  /** 工作区最近一次打开时间，使用 ISO 8601 格式。 */
  lastOpenedAt: string

  /** 本次打开工作区的时间，使用 ISO 8601 格式。 */
  openedAt: string

  /** 该工作区累计打开次数。 */
  openCount: number
}

/**
 * 最近打开的工作区列表项。
 *
 * 主要用于欢迎页的“最近工作区”列表。
 * 不返回完整 files 数组，避免工作区文件较多时查询结果过大。
 */
export interface RecentWorkspace {
  /** workspaces 表中的自增主键。 */
  id: number

  /** 工作区名称。 */
  name: string

  /** 工作区文件夹的绝对路径。 */
  path: string

  /** 最近一次扫描到的受支持文件数量。 */
  fileCount: number

  /** 工作区首次打开时间，使用 ISO 8601 格式。 */
  firstOpenedAt: string

  /** 工作区最近一次打开时间，使用 ISO 8601 格式。 */
  lastOpenedAt: string

  /** 工作区累计打开次数。 */
  openCount: number

  /** 当前设备上是否仍然可以访问该工作区路径。 */
  isAvailable: boolean

  /** 最近一次打开该工作区的设备 ID。 */
  deviceId: string
}

/**
 * 一次独立的工作区打开记录。
 *
 * 每次打开工作区都会新增一条记录，不会覆盖历史数据。
 * 除工作区信息外，还保存当时的设备、系统和运行时环境快照。
 */
export interface WorkspaceOpenRecord {
  /** workspace_open_records 表中的自增主键。 */
  id: number

  /** 关联的工作区 ID。 */
  workspaceId: number

  /** 打开工作区时使用的设备 ID。 */
  deviceId: string

  /** 打开工作区时所在的应用会话 ID。 */
  sessionId: string

  /** 打开时使用的工作区绝对路径。 */
  path: string

  /** 打开时扫描到的受支持文件数量。 */
  fileCount: number

  /** 本次打开时间，使用 ISO 8601 格式。 */
  openedAt: string

  /** 打开工作区时的设备主机名。 */
  hostname: string

  /** 操作系统类型，例如 Darwin、Windows_NT、Linux。 */
  osType: string

  /** 操作系统内核或发行版本。 */
  osRelease: string

  /** 操作系统的完整版本信息。 */
  osVersion: string

  /** CPU 型号。 */
  cpuModel: string

  /** CPU 逻辑核心数量。 */
  cpuCount: number

  /** 设备总内存，单位为字节。 */
  totalMemory: number

  /** 应用运行时使用的语言区域，例如 zh-CN。 */
  locale: string

  /** 设备时区，例如 Asia/Shanghai。 */
  timezone: string

  /** 打开工作区时的应用版本。 */
  appVersion: string

  /** 打开工作区时的 Electron 版本。 */
  electronVersion: string

  /** 打开工作区时的 Node.js 版本。 */
  nodeVersion: string

  /** Node.js 平台标识，例如 darwin、win32、linux。 */
  platform: string

  /** 当前进程架构，例如 arm64、x64。 */
  arch: string
}

/**
 * 当前运行设备及应用环境的信息。
 *
 * devices 表中每个 deviceId 只保存一条设备记录。
 * 应用再次启动时会刷新可能发生变化的系统和版本信息。
 */
export interface DeviceInfo {
  /** 当前设备的持久化 ID。 */
  id: string

  /** 当前设备的主机名。 */
  hostname: string

  /** Node.js 平台标识，例如 darwin、win32、linux。 */
  platform: string

  /** 当前进程架构，例如 arm64、x64。 */
  arch: string

  /** 操作系统类型，例如 Darwin、Windows_NT、Linux。 */
  osType: string

  /** 操作系统内核或发行版本。 */
  osRelease: string

  /** 操作系统的完整版本信息。 */
  osVersion: string

  /** CPU 型号。 */
  cpuModel: string

  /** CPU 逻辑核心数量。 */
  cpuCount: number

  /** 设备总内存，单位为字节。 */
  totalMemory: number

  /** Electron 应用当前使用的语言区域。 */
  locale: string

  /** 当前设备时区。 */
  timezone: string

  /** 当前应用版本。 */
  appVersion: string

  /** 当前 Electron 版本。 */
  electronVersion: string

  /** 当前 Node.js 版本。 */
  nodeVersion: string

  /** 首次识别到该设备的时间，使用 ISO 8601 格式。 */
  firstSeenAt: string

  /** 最近一次识别到该设备的时间，使用 ISO 8601 格式。 */
  lastSeenAt: string
}

/**
 * workspaces 表的原始查询结果。
 *
 * 字段名保持 SQLite 中使用的 snake_case，
 * 只在数据库内部使用，返回给渲染进程前需要转换为 camelCase。
 */
export interface WorkspaceRow {
  /** workspaces 表中的自增主键。 */
  id: number

  /** 工作区名称。 */
  name: string

  /** 工作区原始绝对路径。 */
  path: string

  /** 最近一次扫描到的文件数量。 */
  file_count: number

  /** 首次打开时间。 */
  first_opened_at: string

  /** 最近一次打开时间。 */
  last_opened_at: string

  /** 累计打开次数。 */
  open_count: number

  /**
   * 数据库存储的路径可用状态。
   *
   * SQLite 没有独立的 boolean 类型：
   * - 1 表示可用；
   * - 0 表示不可用。
   */
  is_available: number

  /** 最近一次打开该工作区的设备 ID。 */
  last_device_id: string
}

/**
 * workspace_open_records 表的原始查询结果。
 *
 * 该类型仅用于接收 better-sqlite3 查询结果，
 * 返回给其他模块前需要转换为 WorkspaceOpenRecord。
 */
export interface WorkspaceOpenRecordRow {
  /** 打开记录主键。 */
  id: number

  /** 关联的工作区 ID。 */
  workspace_id: number

  /** 打开时使用的设备 ID。 */
  device_id: string

  /** 打开时所在的应用会话 ID。 */
  session_id: string

  /** 打开时使用的工作区路径。 */
  path: string

  /** 打开时扫描到的文件数量。 */
  file_count: number

  /** 本次打开时间。 */
  opened_at: string

  /** 打开时的设备主机名。 */
  hostname: string

  /** 打开时的操作系统类型。 */
  os_type: string

  /** 打开时的操作系统发行版本。 */
  os_release: string

  /** 打开时的操作系统完整版本。 */
  os_version: string

  /** 打开时的 CPU 型号。 */
  cpu_model: string

  /** 打开时的 CPU 逻辑核心数量。 */
  cpu_count: number

  /** 打开时的设备总内存，单位为字节。 */
  total_memory: number

  /** 打开时的语言区域。 */
  locale: string

  /** 打开时的设备时区。 */
  timezone: string

  /** 打开时的应用版本。 */
  app_version: string

  /** 打开时的 Electron 版本。 */
  electron_version: string

  /** 打开时的 Node.js 版本。 */
  node_version: string

  /** 打开时的 Node.js 平台标识。 */
  platform: string

  /** 打开时的进程架构。 */
  arch: string
}

/**
 * devices 表的原始查询结果。
 *
 * 字段名称与 SQLite 表结构保持一致，
 * 查询后需要转换为 DeviceInfo。
 */
export interface DeviceRow {
  /** 当前设备的持久化 ID。 */
  id: string

  /** 设备主机名。 */
  hostname: string

  /** Node.js 平台标识。 */
  platform: string

  /** 当前进程架构。 */
  arch: string

  /** 操作系统类型。 */
  os_type: string

  /** 操作系统内核或发行版本。 */
  os_release: string

  /** 操作系统完整版本。 */
  os_version: string

  /** CPU 型号。 */
  cpu_model: string

  /** CPU 逻辑核心数量。 */
  cpu_count: number

  /** 设备总内存，单位为字节。 */
  total_memory: number

  /** Electron 应用当前使用的语言区域。 */
  locale: string

  /** 当前设备时区。 */
  timezone: string

  /** 当前应用版本。 */
  app_version: string

  /** 当前 Electron 版本。 */
  electron_version: string

  /** 当前 Node.js 版本。 */
  node_version: string

  /** 首次识别到设备的时间。 */
  first_seen_at: string

  /** 最近一次识别到设备的时间。 */
  last_seen_at: string
}
