import { ipcRenderer } from "electron"
import type { BrowserProxyAPI } from "../../shared/browser-proxy"
export const browserProxyAPI: BrowserProxyAPI = {
  browserProxySubscription: () => ipcRenderer.invoke("browser:proxy:subscription"),
  saveBrowserProxySubscription: url => ipcRenderer.invoke("browser:proxy:save", url),
  browserProxyStatus: () => ipcRenderer.invoke("browser:proxy:status"),
  connectBrowserProxy: (url) => ipcRenderer.invoke("browser:proxy:connect", url),
  disconnectBrowserProxy: () => ipcRenderer.invoke("browser:proxy:disconnect"),
  selectBrowserProxy: (name) => ipcRenderer.invoke("browser:proxy:select", name)
}
