import { contextBridge, ipcRenderer } from "electron"
contextBridge.exposeInMainWorld("screenshotAPI", {
  /** Performs the ready operation. */
  ready: () => ipcRenderer.invoke("shot:ready"),

  /** Performs the data operation. */
  data: () => ipcRenderer.invoke("shot:data"),

  /** Performs the finish operation. */
  finish: (image: string, pin: boolean) => ipcRenderer.invoke("shot:finish", image, pin),

  /** Closes close. */
  close: () => ipcRenderer.invoke("shot:close"),

  translate: (text: string, target: string) => ipcRenderer.invoke("shot:translate", text, target),

  /** Copies text. */
  copyText: (text: string) => ipcRenderer.invoke("shot:copy-text", text),

  /** Copies copy. */
  copy: () => ipcRenderer.invoke("shot:copy")
})
