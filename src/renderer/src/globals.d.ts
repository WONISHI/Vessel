import type { ElectronAPI } from "@electron-toolkit/preload"

/** 工作区中的文件信息。 */
interface WorkspaceFile {
  name: string
  path: string
}

/** 数据库保存后返回的完整工作区数据。 */
interface WorkspaceData {
  id: number
  name: string
  path: string
  files: WorkspaceFile[]
  deviceId: string
  sessionId: string
  firstOpenedAt: string
  lastOpenedAt: string
  openedAt: string
  openCount: number
}

/** 最近打开的工作区。 */
interface RecentWorkspace {
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

/** 工作区的一次打开记录。 */
interface WorkspaceOpenRecord {
  id: number
  workspaceId: number
  deviceId: string
  sessionId: string
  path: string
  fileCount: number
  openedAt: string
  hostname: string
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
  platform: string
  arch: string
}

/** 当前设备和运行环境信息。 */
interface DeviceInfo {
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

/** SQLite 数据库信息。 */
interface StorageInfo {
  databasePath: string
  databaseVersion: number
  deviceId: string
  sessionId: string
}

/** preload 暴露给 React 渲染进程的完整 API。 */
interface VesselAPI {
  /** 选择文件夹并记录工作区打开信息。 */
  openDirectory: () => Promise<WorkspaceData | null>

  /** 获取最近打开的工作区。 */
  getRecentWorkspaces: (limit?: number) => Promise<RecentWorkspace[]>

  /** 获取指定工作区的打开记录。 */
  getWorkspaceOpenRecords: (workspaceId: number, limit?: number) => Promise<WorkspaceOpenRecord[]>

  /** 获取当前设备信息。 */
  getCurrentDevice: () => Promise<DeviceInfo>

  /** 根据 key 读取应用状态。 */
  getAppState: <T>(key: string) => Promise<T | null>

  /** 保存或覆盖应用状态。 */
  setAppState: (key: string, value: unknown) => Promise<void>

  /** 删除应用状态。 */
  deleteAppState: (key: string) => Promise<boolean>

  /** 获取数据库信息。 */
  getStorageInfo: () => Promise<StorageInfo>

  /** 读取文件内容。 */
  readContent: (path: string) => Promise<string>

  /** 保存文件内容。 */
  saveContent: (path: string, content: string) => Promise<void>

  /** 打开或关闭开发者工具。 */
  openDevTool: () => Promise<void>
}

declare module "react-dczs-image-preview"

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: VesselAPI
  }
}

export {}
