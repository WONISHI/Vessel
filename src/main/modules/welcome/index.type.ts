/** 工作区中受支持的文件信息。 */
export interface WorkspaceFile {
  name: string
  path: string
}

/** 从目录选择模块传入的原始工作区数据。 */
export interface WorkspaceDataInput {
  name: string
  path: string
  files: WorkspaceFile[]
}

/** 工作区写入数据库后返回给渲染进程的完整数据。 */
export interface PersistedWorkspaceData extends WorkspaceDataInput {
  id: number
  deviceId: string
  sessionId: string
  firstOpenedAt: string
  lastOpenedAt: string
  openedAt: string
  openCount: number
}

/** 最近打开的工作区列表项，不包含完整文件列表，避免查询结果过大。 */
export interface RecentWorkspace {
  id: number
  name: string
  path: string
  fileCount: number
  firstOpenedAt: string
  lastOpenedAt: string
  openCount: number
  isAvailable: boolean
  deviceId: string
}

/** 一次独立的工作区打开记录。 */
export interface WorkspaceOpenRecord {
  id: number
  workspaceId: number
  deviceId: string
  sessionId: string
  path: string
  fileCount: number
  openedAt: string
  appVersion: string
  electronVersion: string
  platform: string
  arch: string
}

/** 当前运行设备及应用环境的快照信息。 */
export interface DeviceInfo {
  id: string
  hostname: string
  platform: string
  arch: string
  osType: string
  osRelease: string
  osVersion: string
  cpuModel: string
  cpuCount: number
  totalMemory: number
  locale: string
  timezone: string
  appVersion: string
  electronVersion: string
  nodeVersion: string
  firstSeenAt: string
  lastSeenAt: string
}

/** workspaces 表的原始查询结果，字段名保持 SQLite 的 snake_case。 */
export interface WorkspaceRow {
  id: number
  name: string
  path: string
  file_count: number
  first_opened_at: string
  last_opened_at: string
  open_count: number
  is_available: number
  last_device_id: string
}

/** workspace_open_records 表的原始查询结果。 */
export interface WorkspaceOpenRecordRow {
  id: number
  workspace_id: number
  device_id: string
  session_id: string
  path: string
  file_count: number
  opened_at: string
  app_version: string
  electron_version: string
  platform: string
  arch: string
}

/** devices 表的原始查询结果。 */
export interface DeviceRow {
  id: string
  hostname: string
  platform: string
  arch: string
  os_type: string
  os_release: string
  os_version: string
  cpu_model: string
  cpu_count: number
  total_memory: number
  locale: string
  timezone: string
  app_version: string
  electron_version: string
  node_version: string
  first_seen_at: string
  last_seen_at: string
}
