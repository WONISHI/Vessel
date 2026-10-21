import type { ElectronAPI } from "@electron-toolkit/preload"
import type { BrowserExtensionsAPI, BrowserProxyAPI, BrowserToolsAPI, FileWatchAPI, ImageFile, SettingsAPI, TerminalAPI, TodosAPI, TransitFile } from "@vessel/type"

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
interface VesselAPI extends BrowserProxyAPI, BrowserToolsAPI, SettingsAPI, BrowserExtensionsAPI, TodosAPI, TerminalAPI, FileWatchAPI {
  getPerformanceSnapshot: () => Promise<import("@vessel/type").PerformanceSnapshot>
  getSystemInfo: () => Promise<import("@vessel/type").SystemInfo>
  searchContent(options: import("@vessel/type").ContentSearchOptions): Promise<import("@vessel/type").ContentSearchResult>
  cancelContentSearch(): void
  pickSearchFolder(): Promise<string | null>
  readTransitClipboard(): Promise<string | { root: string; path: string; title: string }>
  openTransitWindow(item: { kind: string; content: string; title: string; root?: string }): Promise<void>
  pickOfficeFile(): Promise<{ token: string; name: string; bytes: Uint8Array } | null>
  convertOfficeMarkdown(name: string, bytes: Uint8Array): Promise<{ saved: boolean; path?: string }>
  setWindowAppearance(dark: boolean): Promise<void>
  commitOffice(name: string, bytes: Uint8Array, token?: string): Promise<{ saved: boolean; name?: string; token?: string }>
  renameOffice(token: string | undefined, name: string): Promise<string>
  importTransitFiles(): Promise<Array<{ root: string; path: string; title: string }>>
  readTransitFile(root: string, path: string): Promise<TransitFile>
  getExternalPathInfo(path: string): Promise<{ path: string; name: string; root: string; kind: "file" | "directory" }>
  getDroppedFilePath(file: File): string
  readOfficePath(path: string): Promise<{ token: string; name: string; bytes: Uint8Array }>
  openOffice(): Promise<string>
  saveOffice(name: string, bytes: Uint8Array): Promise<boolean>

  onBrowserDevtoolsClosed: (callback: () => void) => () => void
  onOpenSettings: (callback: () => void) => () => void
  onCommandPalette: (callback: () => void) => () => void
  onBrowserToggleDevtools: (callback: (id: number) => void) => () => void
  onBrowserFind: (callback: (id: number) => void) => () => void
  setBrowserDevtools: (id: number | null, bounds?: { x: number; y: number; width: number; height: number }, appearance?: { font: string; size: number; detached?: boolean }) => Promise<void>
  onBrowserNewTab: (callback: (url: string, opener?: number) => void) => () => void
  takePendingMarkdownFiles: () => Promise<string[]>
  onOpenMarkdown: (callback: (path: string) => void) => () => void
  readWorkspaceDirectory: (root: string, directory: string) => Promise<Array<{ name: string; path: string; type: "file" | "directory"; ctime?: number; mtime?: number }>>
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

  /** 读取文件内容。 */
  revealWorkspaceFile: (root: string, path: string) => Promise<void>
  readClipboardImage: () => Promise<string | null>
  copyImage: (source: string) => Promise<void>
  readImageFile: (root: string, path: string) => Promise<ImageFile>
  readWikiLink: (root: string, target: string) => Promise<{ path: string; content: string }>
  saveObsidianImage: (root: string, documentPath: string, source: { bytes?: Uint8Array; url?: string; path?: string }) => Promise<{ name: string; path: string; reference: string }>
  readObsidianImage: (root: string, documentPath: string, reference: string) => Promise<string>
  transferWorkspaceFiles: (root: string, paths: string[], destination: string, external: boolean, duplicate?: boolean) => Promise<{ source: string; target: string }[]>
  mutateWorkspaceFile: (root: string, path: string, name?: string) => Promise<string>
  getCodeDiagnostics: (path: string, content: string) => Promise<import("@vessel/type").CodeDiagnostic[]>
  createWorkspaceEntry: (root: string, parent: string, name: string, kind: "file" | "directory") => Promise<{ name: string; path: string; type: "file" | "directory" }>
  openExternal: (href: string) => Promise<void>
  queryBase: typeof import("@preload/apis/files.api").filesAPI.queryBase
  readContent: (path: string) => Promise<string>

  /** 保存文件内容。 */
  saveContent: (path: string, content: string) => Promise<void>

  /** 打开或关闭开发者工具。 */
  openDevTool: () => Promise<void>
  onRequestClose?: (callback: () => void) => () => void
  confirmQuit?: () => Promise<void>
  reportCrash?: (crashed: boolean) => Promise<void>
  relaunchApp?: () => Promise<void>
  reloadWindow?: () => Promise<void>
  git: typeof import("@preload/apis/git.api").gitAPI
  apiClient: typeof import("@preload/apis/api-client.api").apiClientAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: VesselAPI
    git: typeof import("@preload/apis/git.api").gitAPI
    apiClient: typeof import("@preload/apis/api-client.api").apiClientAPI
  }
}

export {}
