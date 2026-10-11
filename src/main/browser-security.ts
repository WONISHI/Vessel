import { shouldMonitorNavigation } from "./settings"
import { matchesShortcut } from "../shared/shortcuts"
import { join } from "node:path"
import { registerBrowserProxy } from "./browser-proxy"
import { registerBrowserTools } from "./browser-tools"
import { registerBrowserExtensions } from "./browser-extensions"
import { registerBrowserDevtools } from "./browser-devtools"
import { BrowserWindow, dialog, session, type WebContents } from "electron"
const allowed = (url: string) => {
  try {
    const parsed = new URL(url)
    if (['http:', 'https:', 'file:'].includes(parsed.protocol)) return true
    return parsed.protocol === 'chrome-extension:' && !!session.fromPartition('persist:vessel-browser').extensions.getExtension(parsed.host)
  } catch { return false }
}
export function secureBrowserGuests(contents: WebContents) {
  registerBrowserExtensions(contents)
  registerBrowserProxy(contents)
  registerBrowserDevtools(contents)
  registerBrowserTools(contents)
  contents.on("will-attach-webview", (event, preferences, params) => {
    if (!allowed(params.src) || !["persist:vessel-browser", "persist:vessel-transit"].includes(params.partition)) {
      event.preventDefault()
      return
    }
    preferences.preload = join(__dirname, "../preload/browser-guest.js")
    preferences.nodeIntegration = false
    preferences.nodeIntegrationInSubFrames = false
    preferences.contextIsolation = true
    preferences.sandbox = true
    preferences.webSecurity = true
    preferences.allowRunningInsecureContent = false
  })
  contents.on("did-attach-webview", (_event, guest) => {
    let asking = false
    let anchor: { url: string; expires: number } | undefined
    const bypassPrompt = (url: string) => !shouldMonitorNavigation() || (anchor?.url === url && anchor.expires >= Date.now())
    guest.ipc.on("vessel:anchor-navigation", (event, url: unknown) => {
      if (typeof url === "string" && url.length < 16384 && allowed(url)) anchor = { url, expires: Date.now() + 1000 }
      event.returnValue = true
    })
    const chooseNavigation = (url: string): boolean => {
      if (!allowed(url)) return false
      if (bypassPrompt(url)) return true
      if (guest.session === session.fromPartition("persist:vessel-transit")) return true
      const owner = BrowserWindow.fromWebContents(contents)
      if (!owner || asking || guest.isDestroyed()) return false
      asking = true
      try {
        // A synchronous decision preserves the original request, including form bodies.
        const choice = dialog.showMessageBoxSync(owner, { type: "question", title: "打开页面", message: "在哪里打开此页面？", detail: url, buttons: ["当前页面", "新标签页", "取消"], defaultId: 0, cancelId: 2, noLink: true })
        if (choice === 1 && !contents.isDestroyed()) contents.send("browser:new-tab", url, guest.id)
        return choice === 0
      } finally { asking = false }
    }
    guest.ipc.on("vessel:navigation-choice", (event, url: unknown) => {
      event.returnValue = typeof url === "string" && url.length < 16384 && chooseNavigation(url)
    })
    guest.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return
      if (matchesShortcut(input, "devtools")) { event.preventDefault(); contents.send("browser:toggle-devtools", guest.id) }
      if (matchesShortcut(input, "command")) { event.preventDefault(); contents.send("app:command") }
    })
    guest.on("will-navigate", (event, url) => {
      if (!chooseNavigation(url)) event.preventDefault()
    })
    guest.on("will-redirect", (event, url) => {
      if (!allowed(url)) event.preventDefault()
    })
    guest.setWindowOpenHandler(({ url, postBody, referrer }) => {
      if (!allowed(url)) return { action: "deny" }
      if (bypassPrompt(url) && guest.session !== session.fromPartition("persist:vessel-transit")) {
        contents.send("browser:new-tab", url, guest.id)
        return { action: "deny" }
      }
      if (chooseNavigation(url)) void guest.loadURL(url, { httpReferrer: referrer, ...(postBody ? { postData: postBody.data, extraHeaders: `Content-Type: ${postBody.contentType}` } : {}) }).catch(() => {})
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
