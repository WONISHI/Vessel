import type { TerminalAPI } from "@vessel/type"
import { ipcRenderer } from "electron"
export const terminalAPI: TerminalAPI = {
  /** Performs the terminal start operation. */
  terminalStart: (root, file) => ipcRenderer.invoke("terminal:start", root, file),

  /** Performs the terminal write operation. */
  terminalWrite: (id, data) => ipcRenderer.invoke("terminal:write", id, data),

  /** Performs the terminal resize operation. */
  terminalResize: (id, cols, rows) => ipcRenderer.invoke("terminal:resize", id, cols, rows),

  /** Performs the terminal close operation. */
  terminalClose: (id) => ipcRenderer.invoke("terminal:close", id),

  /** Handles terminal data events. */
  onTerminalData: (callback) => {
    /** Performs the listener operation. */
    const listener = (_event: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
    ipcRenderer.on("terminal:data", listener)
    return () => ipcRenderer.removeListener("terminal:data", listener)
  }
}
