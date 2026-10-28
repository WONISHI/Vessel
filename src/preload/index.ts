import { electronAPI } from "@electron-toolkit/preload"
import { browserExtensionsAPI } from "@preload/apis/browser-extensions.api"
import { browserProxyAPI } from "@preload/apis/browser-proxy.api"
import { developerAPI } from "@preload/apis/developer.api"
import { nativeMenuAPI } from "@preload/apis/native-menu.api"
import { fileWatchAPI } from "@preload/apis/file-watch.api"
import { terminalAPI } from "@preload/apis/terminal.api"
import { todosAPI } from "@preload/apis/todos.api"
import { welcomeAPI } from "@preload/apis/welcome.api"
import type { AppSettings, BackupLogs, BackupStatus, BrowserDevice, TransitFile } from "@vessel/type"
import { contextBridge, ipcRenderer, webUtils } from "electron"

import { apiClientAPI } from "@preload/apis/api-client.api"
import { filesAPI } from "@preload/apis/files.api"
import { gitAPI } from "@preload/apis/git.api"

const api = {}

const vesselAPI = {
  onFilePreviewUpdated: (callback: (state: { items: { id: string; kind: "file"; title: string; root: string; content: string }[]; selected: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: Parameters<typeof callback>[0]) => callback(state)
    ipcRenderer.on("preview:updated", handler)
    return () => ipcRenderer.removeListener("preview:updated", handler)
  },
  getFilePreviewTabs: () => ipcRenderer.invoke("preview:tabs"),
  getFilePreview: () => ipcRenderer.invoke("preview:data"),
  filePreviewAction: (action: "close" | "maximize" | "minimize") => ipcRenderer.invoke("preview:action", action),
  /** Synchronizes browser bookmarks. */
  syncBrowserBookmarks: (items: { url: string; title: string }[]) => ipcRenderer.invoke("browser:bookmarks:sync", items),

  /** Returns browser bookmarks. */
  getBrowserBookmarks: (): Promise<{ url: string; title: string }[]> => ipcRenderer.invoke("browser:bookmarks:get"),

  /** Handles browser bookmarks updated events. */
  onBrowserBookmarksUpdated: (callback: (items: { url: string; title: string }[]) => void) => {
    /** Performs the handler operation. */
    const handler = (_event: Electron.IpcRendererEvent, items: { url: string; title: string }[]) => callback(items)
    ipcRenderer.on("browser:bookmarks-updated", handler)
    return () => {
      ipcRenderer.removeListener("browser:bookmarks-updated", handler)
    }
  },

  /** Lists browser history. */
  listBrowserHistory: () => ipcRenderer.invoke("browser:history:list"),

  /** Deletes browser history. */
  deleteBrowserHistory: (id: number | null) => ipcRenderer.invoke("browser:history:delete", id),

  /** Performs the print browser page operation. */
  printBrowserPage: (id: number) => ipcRenderer.invoke("browser:print", id),

  /** Lists browser devices. */
  listBrowserDevices: () => ipcRenderer.invoke("browser:devices"),

  /** Performs the emulate browser device operation. */
  emulateBrowserDevice: (id: number, device: BrowserDevice | null) => ipcRenderer.invoke("browser:emulate", id, device),

  /** Returns settings. */
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),

  /** Saves settings. */
  saveSettings: (settings: AppSettings, secret?: string): Promise<AppSettings> => ipcRenderer.invoke("settings:save", settings, secret),

  /** Returns settings info. */
  getSettingsInfo: (): Promise<{ version: string; electron: string; node: string }> => ipcRenderer.invoke("settings:info"),

  /** Tests backup. */
  testBackup: (settings: AppSettings["backup"], secret?: string): Promise<void> => ipcRenderer.invoke("settings:test", settings, secret),

  /** Sets backup workspace. */
  setBackupWorkspace: (path: string | null): Promise<void> => ipcRenderer.invoke("settings:workspace", path),

  /** Runs backup. */
  runBackup: (file?: string, workspace?: string): Promise<BackupStatus> => ipcRenderer.invoke("settings:backup", file, workspace),

  /** Performs the preview backup operation. */
  previewBackup: (): Promise<BackupStatus> => ipcRenderer.invoke("settings:preview"),

  /** Returns backup logs. */
  getBackupLogs: (): Promise<BackupLogs> => ipcRenderer.invoke("settings:logs"),

  /** Clears backup logs. */
  clearBackupLogs: (): Promise<void> => ipcRenderer.invoke("settings:logs:clear"),

  /** Returns backup status. */
  getBackupStatus: (): Promise<BackupStatus> => ipcRenderer.invoke("settings:status"),

  /** Imports local files using the native picker. */
  importTransitFiles: (): Promise<Array<{ root: string; path: string; title: string }>> => ipcRenderer.invoke("transit:import-files"),
  /** Reads a file for transit preview. */
  readTransitFile: (root: string, path: string): Promise<TransitFile> => ipcRenderer.invoke("transit:read-file", root, path),

  /** Synchronizes native window chrome with the applied renderer theme. */
  setWindowAppearance: (dark: boolean): Promise<void> => ipcRenderer.invoke("app:appearance", dark),
  /** Picks an Office document. */
  pickOfficeFile: (): Promise<{ token: string; name: string; bytes: Uint8Array } | null> => ipcRenderer.invoke("office:pick"),

  /** Converts the current Office export and asks for an output folder. */
  convertOfficeMarkdown: (name: string, bytes: Uint8Array): Promise<{ saved: boolean; path?: string }> => ipcRenderer.invoke("office:convert-markdown", name, bytes),
  /** Performs the commit office operation. */
  commitOffice: (name: string, bytes: Uint8Array, token?: string): Promise<{ saved: boolean; name?: string; token?: string }> => ipcRenderer.invoke("office:commit", name, bytes, token),

  /** Renames office. */
  renameOffice: (token: string | undefined, name: string): Promise<string> => ipcRenderer.invoke("office:rename", token, name),

  /** Reads transit clipboard. */
  readTransitClipboard: (): Promise<string | { root: string; path: string; title: string }> => ipcRenderer.invoke("transit:clipboard"),

  /** Opens transit window. */
  openTransitWindow: (item: { kind: string; content: string; title: string; root?: string }, tabs?: { root: string; content: string }[]): Promise<void> => ipcRenderer.invoke("transit:window", item, tabs),

  /** Saves office. */
  saveOffice: (name: string, bytes: Uint8Array): Promise<boolean> => ipcRenderer.invoke("office:save", name, bytes),

  /** Returns external path info. */
  getExternalPathInfo: (path: string): Promise<{ path: string; name: string; root: string; kind: "file" | "directory" }> => ipcRenderer.invoke("external:path-info", path),

  /** Returns dropped file path. */
  getDroppedFilePath: (file: File): string => webUtils.getPathForFile(file),

  /** Reads office path. */
  readOfficePath: (path: string) => ipcRenderer.invoke("office:read-path", path),

  /** Opens office. */
  openOffice: (): Promise<string> => ipcRenderer.invoke("office:open"),
  ...terminalAPI,
  ...browserExtensionsAPI,
  ...browserProxyAPI,
  ...fileWatchAPI,

  /** Handles browser devtools closed events. */
  onBrowserDevtoolsClosed: (callback: () => void) => {
    ipcRenderer.on("browser:devtools-closed", callback)
    return () => ipcRenderer.removeListener("browser:devtools-closed", callback)
  },

  /** Handles request close events. */
  onRequestClose: (callback: () => void) => {
    /** Performs the listener operation. */
    const listener = () => callback()
    ipcRenderer.on("app:request-close", listener)
    return () => ipcRenderer.removeListener("app:request-close", listener)
  },

  /** Performs the confirm quit operation. */
  confirmQuit: (): Promise<void> => ipcRenderer.invoke("app:confirm-quit"),

  /** Performs the report crash operation. */
  reportCrash: (crashed: boolean): Promise<void> => ipcRenderer.invoke("app:report-crash", crashed),

  /** Performs the relaunch app operation. */
  relaunchApp: (): Promise<void> => ipcRenderer.invoke("app:relaunch"),

  /** Reloads window. */
  reloadWindow: (): Promise<void> => ipcRenderer.invoke("app:reload"),

  /** Opens the settings route when requested by the native application menu. */
  onOpenSettings: (callback: () => void) => {
    /** Forwards the native menu event without exposing IPC objects. */
    const listener = () => callback()
    ipcRenderer.on("app:open-settings", listener)
    return () => ipcRenderer.removeListener("app:open-settings", listener)
  },

  /** Handles command palette events. */
  onCommandPalette: (callback: (command?: string) => void) => {
    /** Performs the listener operation. */
    const listener = (_event: Electron.IpcRendererEvent, command?: string) => callback(command)
    ipcRenderer.on("app:command", listener)
    return () => ipcRenderer.removeListener("app:command", listener)
  },

  /** Handles browser toggle devtools events. */
  onBrowserToggleDevtools: (callback: (id: number) => void) => {
    /** Performs the listener operation. */
    const listener = (_event: Electron.IpcRendererEvent, id: number) => callback(id)
    ipcRenderer.on("browser:toggle-devtools", listener)
    return () => ipcRenderer.removeListener("browser:toggle-devtools", listener)
  },

  /** Handles browser find events. */
  onBrowserFind: (callback: (id: number) => void) => {
    /** Performs the listener operation. */
    const listener = (_event: Electron.IpcRendererEvent, id: number) => callback(id)
    ipcRenderer.on("browser:find", listener)
    return () => ipcRenderer.removeListener("browser:find", listener)
  },

  /** Sets browser devtools. */
  setBrowserDevtools: (id: number | null, bounds?: Electron.Rectangle, appearance?: { font: string; size: number; detached?: boolean }): Promise<void> => ipcRenderer.invoke("browser:devtools", id, bounds, appearance),

  /** Handles browser new tab events. */
  onBrowserNewTab: (callback: (url: string, opener?: number) => void) => {
    /** Performs the handler operation. */
    const handler = (_event: Electron.IpcRendererEvent, url: string, opener?: number) => callback(url, opener)
    ipcRenderer.on("browser:new-tab", handler)
    return () => {
      ipcRenderer.removeListener("browser:new-tab", handler)
    }
  },

  /** Performs the take pending markdown files operation. */
  takePendingMarkdownFiles: (): Promise<string[]> => ipcRenderer.invoke("markdown:pending"),

  /** Handles open markdown events. */
  onOpenMarkdown: (callback: (path: string) => void) => {
    /** Performs the handler operation. */
    const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path)
    ipcRenderer.on("markdown:open", handler)
    return () => {
      ipcRenderer.removeListener("markdown:open", handler)
    }
  },
  ...todosAPI,
  ...welcomeAPI,
  ...filesAPI,
  ...developerAPI,
  ...nativeMenuAPI,
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
