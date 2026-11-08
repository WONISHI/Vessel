import { ipcRenderer } from "electron"
import type { NativeMenuAPI } from "@vessel/type"

export const nativeMenuAPI: NativeMenuAPI = {
  onFileMenuCommand: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: Parameters<Parameters<NativeMenuAPI["onFileMenuCommand"]>[0]>) => callback(...args)
    ipcRenderer.on("file-menu:command", listener)
    return () => ipcRenderer.removeListener("file-menu:command", listener)
  },
  updateFileMenu: (state) => ipcRenderer.send("file-menu:state", state),
  previewExportedPdf: (path) => ipcRenderer.invoke("file-menu:preview-pdf", path),
  fileMenuDialog: (request) => ipcRenderer.invoke("file-menu:dialog", request)
}
