import type { NativeMenuAPI } from "@vessel/type"
import type { ElectronAPI } from "@electron-toolkit/preload"
import type { BrowserExtensionsAPI, BrowserProxyAPI, BrowserToolsAPI, CodeDiagnostic, ContentSearchOptions, ContentSearchResult, FileWatchAPI, ImageFile, SettingsAPI, TerminalAPI, TodosAPI, TransitFile } from "@vessel/type"

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

export interface VesselAPI extends BrowserProxyAPI, BrowserToolsAPI, SettingsAPI, BrowserExtensionsAPI, TodosAPI, TerminalAPI, FileWatchAPI, NativeMenuAPI {
  getPerformanceSnapshot: () => Promise<import("@vessel/type").PerformanceSnapshot>
  shareFilesToWechat: (root: string, paths: string[]) => Promise<{ opened: boolean }>
  getSystemInfo: () => Promise<import("@vessel/type").SystemInfo>
  searchContent(options: ContentSearchOptions): Promise<ContentSearchResult>
  cancelContentSearch(): void
  pickSearchFolder(): Promise<string | null>
  readTransitClipboard(): Promise<string | { root: string; path: string; title: string }>
  onFilePreviewUpdated(callback: (state: { items: { id: string; kind: "file"; title: string; root: string; content: string }[]; selected: string }) => void): () => void
  selectFilePreview(id: string): Promise<void>
  getFilePreviewTabs(): Promise<{ id: string; kind: "file"; title: string; root: string; content: string }[]>
  getFilePreview(): Promise<{ id: string; kind: "file"; title: string; root: string; content: string }>
  filePreviewAction(action: "close" | "maximize" | "minimize"): Promise<void>
  openTransitWindow(item: { kind: string; content: string; title: string; root?: string }, tabs?: { root: string; content: string }[]): Promise<void>
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
  onCommandPalette: (callback: (command?: string) => void) => () => void
  onBrowserToggleDevtools: (callback: (id: number) => void) => () => void
  onBrowserFind: (callback: (id: number) => void) => () => void
  setBrowserDevtools: (id: number | null, bounds?: { x: number; y: number; width: number; height: number }, appearance?: { font: string; size: number; detached?: boolean }) => Promise<void>
  onBrowserNewTab: (callback: (url: string, opener?: number) => void) => () => void
  takePendingMarkdownFiles: () => Promise<string[]>
  onOpenMarkdown: (callback: (path: string) => void) => () => void
  readWorkspaceDirectory: (root: string, directory: string, options?: { includeIgnored?: boolean }) => Promise<Array<{ name: string; path: string; type: "file" | "directory"; ctime?: number; mtime?: number }>>
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

  restoreWorkspaceTabs(root: string, paths: string[]): Promise<Record<string, string | null>>
  openProjectInEditor(root: string): Promise<string>
  revealWorkspaceFile: (root: string, path: string) => Promise<void>
  readClipboardImage: () => Promise<string | null>
  copyImage: (source: string) => Promise<void>
  readImageFile: (root: string, path: string) => Promise<ImageFile>
  readWikiLink: (root: string, target: string) => Promise<{ path: string; content: string }>
  saveObsidianImage: (root: string, documentPath: string, source: { bytes?: Uint8Array; url?: string; path?: string }) => Promise<{ name: string; path: string; reference: string }>
  resolveObsidianImage: (root: string, documentPath: string, reference: string) => Promise<string>
  getObsidianImageResource: (root: string, documentPath: string, reference: string) => Promise<string>
  readObsidianImage: (root: string, documentPath: string, reference: string) => Promise<string>
  transferWorkspaceFiles: (root: string, paths: string[], destination: string, external: boolean, duplicate?: boolean) => Promise<{ source: string; target: string }[]>
  mutateWorkspaceFile: (root: string, path: string, name?: string) => Promise<string>
  createWorkspaceEntry: (root: string, parent: string, name: string, kind: "file" | "directory") => Promise<{ name: string; path: string; type: "file" | "directory" }>
  openExternal: (href: string) => Promise<void>
  getCodeDiagnostics: (path: string, content: string) => Promise<CodeDiagnostic[]>
  queryBase: typeof import("@preload/apis/files.api").filesAPI.queryBase
  readContent: (path: string) => Promise<string>

  saveContent: (path: string, content: string) => Promise<void>

  deleteObsidianImage: (root: string, documentPath: string, reference: string) => Promise<boolean>
  openDevTool: () => Promise<void>
  previewScreenshot: () => Promise<void>
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
