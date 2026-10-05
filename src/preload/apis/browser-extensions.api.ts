import { ipcRenderer } from "electron"
import type { BrowserExtensionsAPI } from "../../shared/browser-extensions"
export const browserExtensionsAPI: BrowserExtensionsAPI = {
  resizeBrowserExtension: bounds => ipcRenderer.invoke("browser:extensions:bounds", bounds),
  onBrowserExtensionClosed: callback => { const listener = () => callback(); ipcRenderer.on("browser:extensions:closed", listener); return () => ipcRenderer.removeListener("browser:extensions:closed", listener) },
  pinBrowserExtension: (key, pinned) => ipcRenderer.invoke("browser:extensions:pin", key, pinned),
  closeBrowserExtension: () => ipcRenderer.invoke("browser:extensions:close"),
  openBrowserExtension: (key, mode) => ipcRenderer.invoke("browser:extensions:open", key, mode),
  listBrowserExtensions: () => ipcRenderer.invoke("browser:extensions:list"),
  installBrowserExtension: kind => ipcRenderer.invoke("browser:extensions:install", kind),
  setBrowserExtensionEnabled: (key, enabled) => ipcRenderer.invoke("browser:extensions:enabled", key, enabled),
  removeBrowserExtension: key => ipcRenderer.invoke("browser:extensions:remove", key)
}
