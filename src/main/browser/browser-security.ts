import { registerBrowserDevtools } from "@main/browser/browser-devtools"
import { registerBrowserExtensions } from "@main/browser/browser-extensions"
import { registerBrowserProxy } from "@main/browser/browser-proxy"
import { registerBrowserTools } from "@main/browser/browser-tools"
import { generalSettings, shouldMonitorNavigation } from "@main/settings/settings"
import { commandShortcutIds, matchesShortcut } from "@vessel/utils"
import { session, type WebContents } from "electron"
import { join } from "node:path"

/** Performs the allowed operation. */
const allowed = (url: string) => {
  try {
    const parsed = new URL(url)
    if (["http:", "https:", "file:"].includes(parsed.protocol)) return true
    return parsed.protocol === "chrome-extension:" && !!session.fromPartition("persist:vessel-browser").extensions.getExtension(parsed.host)
  } catch {
    return false
  }
}

/** Recognizes search submissions within the same search provider. */
function isSearchNavigation(from: string, to: string) {
  const provider = (url: URL) => {
    if (!["https:", "http:"].includes(url.protocol)) return undefined
    const host = url.hostname
    if (/^(?:www\.)?google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host)) return "google"
    if (host === "bing.com" || host.endsWith(".bing.com")) return "bing"
    if (host === "baidu.com" || host.endsWith(".baidu.com")) return "baidu"
    if (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) return "duckduckgo"
    return undefined
  }
  try {
    const current = new URL(from)
    const target = new URL(to)
    const engine = provider(current)
    if (!engine || engine !== provider(target)) return false
    if (engine === "google" || engine === "bing") return target.pathname === "/search"
    if (engine === "baidu") return target.pathname === "/s"
    return target.pathname === "/" || target.pathname === "/html/" || target.pathname === "/lite/"
  } catch {
    return false
  }
}

/** Performs the secure browser guests operation. */
export function secureBrowserGuests(contents: WebContents) {
  registerBrowserExtensions(contents)
  registerBrowserProxy(contents)
  registerBrowserDevtools(contents)
  registerBrowserTools(contents)
  const decisions = new Map<number, (current: boolean) => void>()
  let decisionId = 0
  contents.ipc.handle("browser:navigation-answer", (_event, id: number, current: boolean) => {
    if (typeof current === "boolean") decisions.get(id)?.(current)
  })
  contents.once("destroyed", () => decisions.clear())
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
    let cancelDecision: (() => void) | undefined
    let resumeFormUntil = 0
    let anchor: { url: string; source: string; expires: number } | undefined

    /** Performs the bypass prompt operation. */
    const bypassPrompt = (url: string) => !shouldMonitorNavigation() || isSearchNavigation(guest.getURL(), url) || (anchor !== undefined && anchor.expires >= Date.now() && (anchor.url === url || anchor.source === guest.getURL()))
    guest.ipc.on("vessel:anchor-navigation", (event, url: unknown) => {
      if (typeof url === "string" && url.length < 16384 && allowed(url)) anchor = { url, source: guest.getURL(), expires: Date.now() + 1000 }
      event.returnValue = true
    })

    /** Performs the choose navigation operation. */
    const chooseNavigation = (url: string, defaultCurrent = true, loadCurrent = () => { void guest.loadURL(url).catch(() => {}) }): boolean => {
      if (!allowed(url)) return false
      if (bypassPrompt(url)) return true
      if (guest.session === session.fromPartition("persist:vessel-transit")) return true
      cancelDecision?.()
      const id = ++decisionId
      const originalUrl = guest.getURL()
      const finish = (current: boolean) => {
        cancelDecision?.()
        if (guest.isDestroyed() || contents.isDestroyed() || guest.getURL() !== originalUrl) return
        if (current) loadCurrent()
        else contents.send("browser:new-tab", url, guest.id)
      }
      const delayMs = generalSettings().navigationDelayMs ?? 3000
      const timer = setTimeout(() => finish(defaultCurrent), delayMs)
      cancelDecision = () => {
        clearTimeout(timer)
        decisions.delete(id)
        if (!contents.isDestroyed()) contents.send("browser:navigation-dismiss", id)
        cancelDecision = undefined
      }
      decisions.set(id, finish)
      contents.send("browser:navigation-request", { id, url, defaultCurrent, delayMs })
      return false
    }
    guest.ipc.on("vessel:form-navigation-choice", (event, url: unknown, token: unknown) => {
      if (typeof url !== "string" || url.length >= 16384 || typeof token !== "number") {
        event.returnValue = false
        return
      }
      event.returnValue = chooseNavigation(url, true, () => {
        resumeFormUntil = Date.now() + 1000
        guest.send("vessel:resume-form", token)
      })
    })
    guest.ipc.on("vessel:navigation-choice", (event, url: unknown) => {
      event.returnValue = typeof url === "string" && url.length < 16384 && chooseNavigation(url)
    })
    guest.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return
      if (matchesShortcut(input, "refreshBrowser")) {
        event.preventDefault()
        if (!input.isAutoRepeat) guest.reload()
        return
      }
      if (matchesShortcut(input, "devtools")) {
        event.preventDefault()
        if (!input.isAutoRepeat) contents.send("browser:toggle-devtools", guest.id)
      }
      const command = commandShortcutIds.find((id) => matchesShortcut(input, id))
      if (command) {
        event.preventDefault()
        if (!input.isAutoRepeat) contents.send("app:command", command)
      }
    })
    guest.on("will-navigate", (event, url) => {
      if (resumeFormUntil >= Date.now() && allowed(url)) {
        resumeFormUntil = 0
        return
      }
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
      const loadCurrent = () => { void guest.loadURL(url, { httpReferrer: referrer, ...(postBody ? { postData: postBody.data, extraHeaders: `Content-Type: ${postBody.contentType}` } : {}) }).catch(() => {}) }
      if (chooseNavigation(url, false, loadCurrent)) loadCurrent()
      return { action: "deny" }
    })
    guest.on("destroyed", () => cancelDecision?.())
    guest.on("did-start-navigation", (_event, _url, _inPlace, mainFrame) => {
      if (mainFrame) cancelDecision?.()
    })
    guest.on("dom-ready", () => {
      void guest
        .insertCSS(
          `
        :root {
          --vessel-scrollbar-track: transparent;
          --vessel-scrollbar-thumb: #e4e4e7;
          --vessel-scrollbar-hover: #a1a1aa;
        }
        @media (prefers-color-scheme: dark) { :root {
          --vessel-scrollbar-track: #22272e;
          --vessel-scrollbar-thumb: #555f6b;
          --vessel-scrollbar-hover: #7d8997;
        } }
        * { scrollbar-color: var(--vessel-scrollbar-thumb) var(--vessel-scrollbar-track) !important; }
        ::-webkit-scrollbar { width: 10px !important; height: 10px !important; }
        ::-webkit-scrollbar-track { background: var(--vessel-scrollbar-track) !important; }
        ::-webkit-scrollbar-thumb { background: var(--vessel-scrollbar-thumb) !important; border: 2px solid transparent; background-clip: padding-box !important; border-radius: 999px; }
        ::-webkit-scrollbar-corner { background: var(--vessel-scrollbar-track) !important; }
        ::-webkit-scrollbar-thumb:hover { background-color: var(--vessel-scrollbar-hover) !important; }
      `,
          { cssOrigin: "user" }
        )
        .catch(() => {})
    })
    const allowedPermissions = new Set(["clipboard-read", "clipboard-sanitized-write", "clipboard-write", "fullscreen"])
    guest.session.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(allowedPermissions.has(permission) || permission.startsWith("clipboard"))
    })
    guest.session.setPermissionCheckHandler((_webContents, permission) => {
      return allowedPermissions.has(permission) || permission.startsWith("clipboard")
    })
  })
}
