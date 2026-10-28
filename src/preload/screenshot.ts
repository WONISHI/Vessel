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

  pinMenu: () => ipcRenderer.invoke("shot:pin-menu"),
  pinStyle: (style: { opacity?: number; shadow?: boolean }) => ipcRenderer.invoke("shot:pin-style", style),
  onPinStyleToggle: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on("shot:pin-style-toggle", handler)
    return () => ipcRenderer.removeListener("shot:pin-style-toggle", handler)
  },

  /** Copies copy. */
  copy: () => ipcRenderer.invoke("shot:copy")
})
