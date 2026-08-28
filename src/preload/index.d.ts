import type { ElectronAPI } from "@electron-toolkit/preload"

export interface WorkspaceFile {
  name: string
  path: string
}

/** 目录选择完成后产生的基础工作区数据。 */
export interface WorkspaceDataInput {
  name: string
  path: string
  files: WorkspaceFile[]
}

/** 数据库保存后返回的完整工作区数据。 */
export interface WorkspaceData extends WorkspaceDataInput {
  id: number
  deviceId: string
  sessionId: string
  firstOpenedAt: string
  lastOpenedAt: string
  openedAt: string
  openCount: number
}

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

export interface WorkspaceOpenRecord {
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

export interface StorageInfo {
  databasePath: string
  databaseVersion: number
  deviceId: string
  sessionId: string
}

export interface VesselAPI {
  openDirectory: () => Promise<WorkspaceData | null>

  getRecentWorkspaces: (limit?: number) => Promise<RecentWorkspace[]>

  getWorkspaceOpenRecords: (workspaceId: number, limit?: number) => Promise<WorkspaceOpenRecord[]>

  getCurrentDevice: () => Promise<DeviceInfo>

  getAppState: <T>(key: string) => Promise<T | null>

  setAppState: (key: string, value: unknown) => Promise<void>

  deleteAppState: (key: string) => Promise<boolean>

  getStorageInfo: () => Promise<StorageInfo>

  readContent: (path: string) => Promise<string>

  saveContent: (path: string, content: string) => Promise<void>

  openDevTool: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: VesselAPI
  }
}
