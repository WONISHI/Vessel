import { ipcRenderer } from "electron"
import type { BrowserExtensionsAPI } from "../../shared/browser-extensions"
export const browserExtensionsAPI: BrowserExtensionsAPI = {
  listBrowserExtensions: () => ipcRenderer.invoke("browser:extensions:list"),
  installBrowserExtension: () => ipcRenderer.invoke("browser:extensions:install"),
  setBrowserExtensionEnabled: (key, enabled) => ipcRenderer.invoke("browser:extensions:enabled", key, enabled),
  removeBrowserExtension: key => ipcRenderer.invoke("browser:extensions:remove", key)
}
