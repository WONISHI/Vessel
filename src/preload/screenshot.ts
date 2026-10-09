import { contextBridge, ipcRenderer } from "electron"
contextBridge.exposeInMainWorld("screenshotAPI", {
  ready: () => ipcRenderer.invoke("shot:ready"),
  data: () => ipcRenderer.invoke("shot:data"),
  finish: (image: string, pin: boolean) => ipcRenderer.invoke("shot:finish", image, pin),
  close: () => ipcRenderer.invoke("shot:close"),
  copyText: (text: string) => ipcRenderer.invoke("shot:copy-text", text),
  copy: () => ipcRenderer.invoke("shot:copy")
})
