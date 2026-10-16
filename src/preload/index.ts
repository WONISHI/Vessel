import { browserProxyAPI } from "./apis/browser-proxy.api"
import type { AppSettings, BackupStatus, BackupLogs, TransitFile, BrowserDevice } from "@vessel/type"
import { browserExtensionsAPI } from "./apis/browser-extensions.api"
import { fileWatchAPI } from "./apis/file-watch.api"
import { terminalAPI } from "./apis/terminal.api"
import { todosAPI } from "./apis/todos.api"
import { contextBridge, ipcRenderer, webUtils } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import { welcomeAPI } from "./apis/welcome.api"
import { developerAPI } from "./apis/developer.api"

import { filesAPI } from "./apis/files.api"
import { gitAPI } from "./apis/git.api"
import { apiClientAPI } from "./apis/api-client.api"

const api = {}

const vesselAPI = {
  syncBrowserBookmarks: (items: { url: string; title: string }[]) => ipcRenderer.invoke("browser:bookmarks:sync", items),
  getBrowserBookmarks: (): Promise<{ url: string; title: string }[]> => ipcRenderer.invoke("browser:bookmarks:get"),
  onBrowserBookmarksUpdated: (callback: (items: { url: string; title: string }[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, items: { url: string; title: string }[]) => callback(items)
    ipcRenderer.on("browser:bookmarks-updated", handler)
    return () => { ipcRenderer.removeListener("browser:bookmarks-updated", handler) }
  },
  listBrowserHistory: () => ipcRenderer.invoke("browser:history:list"),
  deleteBrowserHistory: (id: number | null) => ipcRenderer.invoke("browser:history:delete", id),
  printBrowserPage: (id: number) => ipcRenderer.invoke("browser:print", id),
  listBrowserDevices: () => ipcRenderer.invoke("browser:devices"),
  emulateBrowserDevice: (id: number, device: BrowserDevice | null) => ipcRenderer.invoke("browser:emulate", id, device),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: AppSettings, secret?: string): Promise<AppSettings> => ipcRenderer.invoke("settings:save", settings, secret),
  getSettingsInfo: (): Promise<{ version: string; electron: string; node: string }> => ipcRenderer.invoke("settings:info"),
  testBackup: (settings: AppSettings["backup"], secret?: string): Promise<void> => ipcRenderer.invoke("settings:test", settings, secret),
  setBackupWorkspace: (path: string | null): Promise<void> => ipcRenderer.invoke("settings:workspace", path),
  runBackup: (file?: string, workspace?: string): Promise<BackupStatus> => ipcRenderer.invoke("settings:backup", file, workspace),
  previewBackup: (): Promise<BackupStatus> => ipcRenderer.invoke("settings:preview"),
  getBackupLogs: (): Promise<BackupLogs> => ipcRenderer.invoke("settings:logs"),
  clearBackupLogs: (): Promise<void> => ipcRenderer.invoke("settings:logs:clear"),
  getBackupStatus: (): Promise<BackupStatus> => ipcRenderer.invoke("settings:status"),
  readTransitFile: (root: string, path: string): Promise<TransitFile> => ipcRenderer.invoke("transit:read-file", root, path),
  pickOfficeFile: (): Promise<{ token: string; name: string; bytes: Uint8Array } | null> => ipcRenderer.invoke("office:pick"),
  commitOffice: (name: string, bytes: Uint8Array, token?: string): Promise<{ saved: boolean; name?: string; token?: string }> => ipcRenderer.invoke("office:commit", name, bytes, token),
  renameOffice: (token: string | undefined, name: string): Promise<string> => ipcRenderer.invoke("office:rename", token, name),
  readTransitClipboard: (): Promise<string | { root: string; path: string; title: string }> => ipcRenderer.invoke("transit:clipboard"),
  openTransitWindow: (item: { kind: string; content: string; title: string; root?: string }): Promise<void> => ipcRenderer.invoke("transit:window", item),
  saveOffice: (name: string, bytes: Uint8Array): Promise<boolean> => ipcRenderer.invoke("office:save", name, bytes),
  getExternalPathInfo: (path: string): Promise<{ path: string; name: string; root: string; kind: "file" | "directory" }> => ipcRenderer.invoke("external:path-info", path),
  getDroppedFilePath: (file: File): string => webUtils.getPathForFile(file),
  readOfficePath: (path: string) => ipcRenderer.invoke("office:read-path", path),
  openOffice: (): Promise<string> => ipcRenderer.invoke("office:open"),
  ...terminalAPI,
  ...browserExtensionsAPI,
  ...browserProxyAPI,
  ...fileWatchAPI,
  onBrowserDevtoolsClosed: (callback: () => void) => {
    ipcRenderer.on("browser:devtools-closed", callback)
    return () => ipcRenderer.removeListener("browser:devtools-closed", callback)
  },
  onRequestClose: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on("app:request-close", listener)
    return () => ipcRenderer.removeListener("app:request-close", listener)
  },
  confirmQuit: (): Promise<void> => ipcRenderer.invoke("app:confirm-quit"),
  reportCrash: (crashed: boolean): Promise<void> => ipcRenderer.invoke("app:report-crash", crashed),
  relaunchApp: (): Promise<void> => ipcRenderer.invoke("app:relaunch"),
  reloadWindow: (): Promise<void> => ipcRenderer.invoke("app:reload"),
  onCommandPalette: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on("app:command", listener)
    return () => ipcRenderer.removeListener("app:command", listener)
  },
  onBrowserToggleDevtools: (callback: (id: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: number) => callback(id)
    ipcRenderer.on("browser:toggle-devtools", listener)
    return () => ipcRenderer.removeListener("browser:toggle-devtools", listener)
  },
  onBrowserFind: (callback: (id: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: number) => callback(id)
    ipcRenderer.on("browser:find", listener)
    return () => ipcRenderer.removeListener("browser:find", listener)
  },
  setBrowserDevtools: (id: number | null, bounds?: Electron.Rectangle, appearance?: { font: string; size: number; detached?: boolean }): Promise<void> => ipcRenderer.invoke("browser:devtools", id, bounds, appearance),
  onBrowserNewTab: (callback: (url: string, opener?: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, url: string, opener?: number) => callback(url, opener)
    ipcRenderer.on("browser:new-tab", handler)
    return () => { ipcRenderer.removeListener("browser:new-tab", handler) }
  },
  takePendingMarkdownFiles: (): Promise<string[]> => ipcRenderer.invoke("markdown:pending"),
  onOpenMarkdown: (callback: (path: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path)
    ipcRenderer.on("markdown:open", handler)
    return () => { ipcRenderer.removeListener("markdown:open", handler) }
  },
  ...todosAPI,
  ...welcomeAPI,
  ...filesAPI,
  ...developerAPI,
  git: gitAPI,
  apiClient: apiClientAPI,
  ...gitAPI,
  ...apiClientAPI
}

ipcRenderer.on("settings:status-changed", (_event, status: BackupStatus) => {
  window.dispatchEvent(new CustomEvent("vessel:sync-status", { detail: status }))
})

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
    contextBridge.exposeInMainWorld("electronAPI", vesselAPI)
    contextBridge.exposeInMainWorld("git", gitAPI)
    contextBridge.exposeInMainWorld("apiClient", apiClientAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore 已在 index.d.ts 中声明
  window.electron = electronAPI

  // @ts-ignore 已在 index.d.ts 中声明
  window.api = api

  // @ts-ignore 已在 index.d.ts 中声明
  window.electronAPI = vesselAPI

  // @ts-ignore 已在 index.d.ts 中声明
  window.git = gitAPI

  // @ts-ignore 已在 index.d.ts 中声明
  window.apiClient = apiClientAPI
}
