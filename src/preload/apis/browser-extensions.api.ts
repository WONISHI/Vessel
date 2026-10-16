import type { BrowserExtensionsAPI } from "@vessel/type"
import { ipcRenderer } from "electron"
export const browserExtensionsAPI: BrowserExtensionsAPI = {
  /** Performs the extension scroll operation. */
  extensionScroll: (top) => ipcRenderer.invoke("browser:extensions:scroll", top),

  /** Resizes browser extension. */
  resizeBrowserExtension: (bounds) => ipcRenderer.invoke("browser:extensions:bounds", bounds),

  /** Handles browser extension closed events. */
  onBrowserExtensionClosed: (callback) => {
    /** Performs the listener operation. */
    const listener = () => callback()
    ipcRenderer.on("browser:extensions:closed", listener)
    return () => ipcRenderer.removeListener("browser:extensions:closed", listener)
  },

  /** Performs the pin browser extension operation. */
  pinBrowserExtension: (key, pinned) => ipcRenderer.invoke("browser:extensions:pin", key, pinned),

  /** Closes browser extension. */
  closeBrowserExtension: () => ipcRenderer.invoke("browser:extensions:close"),

  /** Opens browser extension. */
  openBrowserExtension: (key, mode) => ipcRenderer.invoke("browser:extensions:open", key, mode),

  /** Lists browser extensions. */
  listBrowserExtensions: () => ipcRenderer.invoke("browser:extensions:list"),

  /** Performs the install browser extension operation. */
  installBrowserExtension: (kind) => ipcRenderer.invoke("browser:extensions:install", kind),

  /** Sets browser extension enabled. */
  setBrowserExtensionEnabled: (key, enabled) => ipcRenderer.invoke("browser:extensions:enabled", key, enabled),

  /** Removes browser extension. */
  removeBrowserExtension: (key) => ipcRenderer.invoke("browser:extensions:remove", key)
}
