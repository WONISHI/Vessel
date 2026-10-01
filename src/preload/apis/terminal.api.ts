import { ipcRenderer } from "electron"
import type { TerminalAPI } from "../../shared/terminal"
export const terminalAPI: TerminalAPI = {
  terminalStart: (root, file) => ipcRenderer.invoke("terminal:start", root, file),
  terminalWrite: (id, data) => ipcRenderer.invoke("terminal:write", id, data),
  terminalResize: (id, cols, rows) => ipcRenderer.invoke("terminal:resize", id, cols, rows),
  terminalClose: id => ipcRenderer.invoke("terminal:close", id),
  onTerminalData: callback => {
    const listener = (_event: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
    ipcRenderer.on("terminal:data", listener)
    return () => ipcRenderer.removeListener("terminal:data", listener)
  }
}
