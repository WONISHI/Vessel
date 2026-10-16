import type { FileChange, FileWatchAPI } from "@vessel/type"
import { ipcRenderer } from "electron"
export const fileWatchAPI: FileWatchAPI = {
  /** Watches start. */
  watchStart: (root) => ipcRenderer.invoke("files:watch", root),

  /** Watches stop. */
  watchStop: (id) => ipcRenderer.invoke("files:unwatch", id),

  /** Handles files changed events. */
  onFilesChanged: (callback) => {
    /** Performs the listener operation. */
    const listener = (_event: Electron.IpcRendererEvent, root: string, changes: FileChange[], error?: string) => callback(root, changes, error)
    ipcRenderer.on("files:changed", listener)
    return () => {
      ipcRenderer.removeListener("files:changed", listener)
    }
  }
}
