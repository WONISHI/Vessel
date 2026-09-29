import { registerBrowserDevtools } from "./browser-devtools"
import type { WebContents } from "electron"
const allowed = (url: string) => /^https?:\/\//i.test(url)
export function secureBrowserGuests(contents: WebContents) {
  registerBrowserDevtools(contents)
  contents.on("will-attach-webview", (event, preferences, params) => {
    if (!allowed(params.src) || params.partition !== "persist:vessel-browser") {
      event.preventDefault()
      return
    }
    delete preferences.preload
    preferences.nodeIntegration = false
    preferences.nodeIntegrationInSubFrames = false
    preferences.contextIsolation = true
    preferences.sandbox = true
    preferences.webSecurity = true
    preferences.allowRunningInsecureContent = false
  })
  contents.on("did-attach-webview", (_event, guest) => {
    guest.on("will-navigate", (event, url) => {
      if (!allowed(url)) event.preventDefault()
      else { event.preventDefault(); contents.send("browser:new-tab", url) }
    })
    guest.on("will-redirect", (event, url) => {
      if (!allowed(url)) event.preventDefault()
    })
    guest.setWindowOpenHandler(({ url }) => {
      if (allowed(url)) contents.send("browser:new-tab", url)
      return { action: "deny" }
    })
    guest.on("dom-ready", () => {
      void guest.insertCSS(`
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e4e4e7; border: 2px solid transparent; background-clip: padding-box; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background-color: #a1a1aa; }
      `).catch(() => {})
    })
    guest.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    guest.session.setPermissionCheckHandler(() => false)
  })
}
