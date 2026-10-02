import { registerBrowserExtensions } from "./browser-extensions"
import { registerBrowserDevtools } from "./browser-devtools"
import { session, type WebContents } from "electron"
const allowed = (url: string) => /^https?:\/\//i.test(url)
export function secureBrowserGuests(contents: WebContents) {
  registerBrowserExtensions(contents)
  registerBrowserDevtools(contents)
  contents.on("will-attach-webview", (event, preferences, params) => {
    if (!allowed(params.src) || !["persist:vessel-browser", "persist:vessel-transit"].includes(params.partition)) {
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
    let documentURL = guest.getURL()
    guest.on("did-navigate", (_event, url) => { documentURL = url })
    guest.on("did-fail-load", (_event, _code, _description, url, mainFrame) => {
      if (mainFrame && allowed(url)) documentURL = url
    })
    guest.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && (input.control || input.meta) && input.key.toLowerCase() === "f") {
        event.preventDefault()
        contents.send("browser:find", guest.id)
      }
    })
    guest.on("will-navigate", (event, url) => {
      if (!allowed(url)) event.preventDefault()
      else if (guest.session !== session.fromPartition("persist:vessel-transit") && url !== guest.getURL() && url !== documentURL) { event.preventDefault(); contents.send("browser:new-tab", url) }
    })
    guest.on("will-redirect", (event, url) => {
      if (!allowed(url)) event.preventDefault()
    })
    guest.setWindowOpenHandler(({ url }) => {
      if (allowed(url)) {
        if (guest.session === session.fromPartition("persist:vessel-transit")) void guest.loadURL(url).catch(() => {})
        else contents.send("browser:new-tab", url)
      }
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
