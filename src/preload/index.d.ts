import type { BrowserProxyAPI } from "../shared/browser-proxy"
import type { BrowserToolsAPI } from "../shared/browser-tools"
import type { SettingsAPI } from "../shared/settings"
import type { TransitFile } from "../shared/transit"
import type { BrowserExtensionsAPI } from "../shared/browser-extensions"
import type { FileWatchAPI } from "../shared/file-watch"
import type { TerminalAPI } from "../shared/terminal"
import type { ImageFile } from "../shared/image-file"
import type { TodosAPI } from "../shared/todos"
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

export interface VesselAPI extends BrowserProxyAPI, BrowserToolsAPI, SettingsAPI, BrowserExtensionsAPI, TodosAPI, TerminalAPI, FileWatchAPI {
  readTransitClipboard(): Promise<string | { root: string; path: string; title: string }>
  openTransitWindow(item: { kind: string; content: string; title: string; root?: string }): Promise<void>
  pickOfficeFile(): Promise<{ token: string; name: string; bytes: Uint8Array } | null>
  commitOffice(name: string, bytes: Uint8Array, token?: string): Promise<{ saved: boolean; name?: string; token?: string }>
  renameOffice(token: string | undefined, name: string): Promise<string>
  readTransitFile(root: string, path: string): Promise<TransitFile>
  openOffice(): Promise<string>
  saveOffice(name: string, bytes: Uint8Array): Promise<boolean>

  onBrowserDevtoolsClosed: (callback: () => void) => () => void
  onCommandPalette: (callback: () => void) => () => void
  onBrowserToggleDevtools: (callback: (id: number) => void) => () => void
  onBrowserFind: (callback: (id: number) => void) => () => void
  setBrowserDevtools: (id: number | null, bounds?: { x: number; y: number; width: number; height: number }, appearance?: { font: string; size: number; detached?: boolean }) => Promise<void>
  onBrowserNewTab: (callback: (url: string, opener?: number) => void) => () => void
  takePendingMarkdownFiles: () => Promise<string[]>
  onOpenMarkdown: (callback: (path: string) => void) => () => void
  readWorkspaceDirectory: (root: string, directory: string) => Promise<Array<{ name: string; path: string; type: "file" | "directory" }>>
  openDirectory: () => Promise<WorkspaceData | null>

  getRecentWorkspaces: (limit?: number) => Promise<RecentWorkspace[]>

  getWorkspaceOpenRecords: (workspaceId: number, limit?: number) => Promise<WorkspaceOpenRecord[]>

  getCurrentDevice: () => Promise<DeviceInfo>

  getAppState: <T>(key: string) => Promise<T | null>

  setAppState: (key: string, value: unknown) => Promise<void>

  deleteAppState: (key: string) => Promise<boolean>

  listStorageTables: () => Promise<
    Array<{
      name: string
      rowCount: number
      columns: Array<{ name: string; type: string; primaryKey: number }>
    }>
  >
  readStorageTable: (
    name: string,
    page?: number,
    keyword?: string,
    pageSize?: number
  ) => Promise<{
    rows: Record<string, unknown>[]
    total: number
    page: number
  }>
  getStorageInfo: () => Promise<StorageInfo>

  revealWorkspaceFile: (root: string, path: string) => Promise<void>
  readClipboardImage: () => Promise<string | null>
  readImageFile: (root: string, path: string) => Promise<ImageFile>
  readWikiLink: (root: string, target: string) => Promise<{ path: string; content: string }>
  readObsidianImage: (root: string, documentPath: string, reference: string) => Promise<string>
  mutateWorkspaceFile: (root: string, path: string, name?: string) => Promise<string>
  createWorkspaceEntry: (root: string, parent: string, name: string, kind: "file" | "directory") => Promise<{name: string; path: string; type: "file" | "directory"}>
  openExternal: (href: string) => Promise<void>
  getCodeDiagnostics: (path: string, content: string) => Promise<import("../shared/code-diagnostics").CodeDiagnostic[]>
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
