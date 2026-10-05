import { contextBridge, ipcRenderer } from "electron"
contextBridge.exposeInMainWorld("screenshotAPI", {
  data: () => ipcRenderer.invoke("shot:data"),
  finish: (image: string, pin: boolean) => ipcRenderer.invoke("shot:finish", image, pin),
  close: () => ipcRenderer.invoke("shot:close"),
  copy: () => ipcRenderer.invoke("shot:copy")
})
