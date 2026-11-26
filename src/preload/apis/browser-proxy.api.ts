import type { BrowserProxyAPI } from "@vessel/type"
import { ipcRenderer } from "electron"
export const browserProxyAPI: BrowserProxyAPI = {
  getBrowserProxyProfileNodes: id => ipcRenderer.invoke("browser:proxy:profile-nodes", id),
  refreshBrowserProxySubscriptionInfo: id => ipcRenderer.invoke("browser:proxy:profile-info", id),
  setBrowserProxyRuntime: input => ipcRenderer.invoke("browser:proxy:runtime", input),
  listBrowserProxySubscriptions: () => ipcRenderer.invoke("browser:proxy:profiles"),
  saveBrowserProxyProfile: input => ipcRenderer.invoke("browser:proxy:profile-save", input),
  deleteBrowserProxyProfile: id => ipcRenderer.invoke("browser:proxy:profile-delete", id),
  connectBrowserProxyProfile: id => ipcRenderer.invoke("browser:proxy:profile-connect", id),
  /** Performs the browser proxy subscription operation. */
  browserProxySubscription: () => ipcRenderer.invoke("browser:proxy:subscription"),

  /** Saves browser proxy subscription. */
  saveBrowserProxySubscription: (url) => ipcRenderer.invoke("browser:proxy:save", url),

  /** Performs the browser proxy status operation. */
  browserProxyStatus: () => ipcRenderer.invoke("browser:proxy:status"),

  /** Connects browser proxy. */
  connectBrowserProxy: (url) => ipcRenderer.invoke("browser:proxy:connect", url),

  /** Disconnects browser proxy. */
  disconnectBrowserProxy: () => ipcRenderer.invoke("browser:proxy:disconnect"),

  /** Selects browser proxy. */
  selectBrowserProxy: (name) => ipcRenderer.invoke("browser:proxy:select", name)
}
