import { fileWatchAPI } from "./apis/file-watch.api"
import { terminalAPI } from "./apis/terminal.api"
import { todosAPI } from "./apis/todos.api"
import { contextBridge, ipcRenderer } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import { welcomeAPI } from "./apis/welcome.api"
import { developerAPI } from "./apis/developer.api"

import { filesAPI } from "./apis/files.api"

const api = {}

const vesselAPI = {
  ...terminalAPI,
  ...fileWatchAPI,
  onBrowserDevtoolsClosed: (callback: () => void) => {
    ipcRenderer.on("browser:devtools-closed", callback)
    return () => ipcRenderer.removeListener("browser:devtools-closed", callback)
  },
  onBrowserFind: (callback: (id: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: number) => callback(id)
    ipcRenderer.on("browser:find", listener)
    return () => ipcRenderer.removeListener("browser:find", listener)
  },
  setBrowserDevtools: (id: number | null, bounds?: Electron.Rectangle, appearance?: { font: string; size: number; detached?: boolean }): Promise<void> => ipcRenderer.invoke("browser:devtools", id, bounds, appearance),
  onBrowserNewTab: (callback: (url: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, url: string) => callback(url)
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
  ...developerAPI
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)

    contextBridge.exposeInMainWorld("api", api)

    contextBridge.exposeInMainWorld("electronAPI", vesselAPI)
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
}
