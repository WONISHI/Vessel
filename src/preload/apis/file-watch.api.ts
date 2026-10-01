import { ipcRenderer } from "electron"
import type { FileWatchAPI, FileChange } from "../../shared/file-watch"
export const fileWatchAPI: FileWatchAPI = {
  watchStart: root => ipcRenderer.invoke("files:watch", root),
  watchStop: id => ipcRenderer.invoke("files:unwatch", id),
  onFilesChanged: callback => {
    const listener = (_event: Electron.IpcRendererEvent, root: string, changes: FileChange[], error?: string) => callback(root, changes, error)
    ipcRenderer.on("files:changed", listener)
    return () => { ipcRenderer.removeListener("files:changed", listener) }
  }
}
