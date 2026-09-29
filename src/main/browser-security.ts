import type { WebContents } from "electron"
const allowed = (url: string) => /^https?:\/\//i.test(url)
export function secureBrowserGuests(contents: WebContents) {
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
    })
    guest.on("will-redirect", (event, url) => {
      if (!allowed(url)) event.preventDefault()
    })
    guest.setWindowOpenHandler(({ url }) => {
      if (allowed(url)) void guest.loadURL(url).catch(() => {})
      return { action: "deny" }
    })
    guest.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    guest.session.setPermissionCheckHandler(() => false)
  })
}
