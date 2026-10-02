import { contextBridge, ipcRenderer } from "electron"
contextBridge.exposeInMainWorld("officeAPI", { save: (name: string, bytes: Uint8Array): Promise<boolean> => ipcRenderer.invoke("office:save", name, bytes) })
