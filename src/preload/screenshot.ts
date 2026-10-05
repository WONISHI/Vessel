import { contextBridge, ipcRenderer } from "electron"
contextBridge.exposeInMainWorld("screenshotAPI", {
  data: () => ipcRenderer.invoke("shot:data"),
  finish: (image: string) => ipcRenderer.invoke("shot:finish", image),
  close: () => ipcRenderer.invoke("shot:close"),
  copy: () => ipcRenderer.invoke("shot:copy")
})
