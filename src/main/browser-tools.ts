import { app, webContents, session, type WebContents } from "electron"
import { join } from "node:path"
import { BrowserHistory } from "./browser-history"
import type { BrowserDevice } from "../shared/browser-tools"
let history: BrowserHistory | undefined
function store() {
  if (!history) {
    history = new BrowserHistory(join(app.getPath("userData"), "browser-history.sqlite"))
    const timer = setInterval(() => history?.prune(), 3600000)
    timer.unref()
    app.once("will-quit", () => { clearInterval(timer); history?.close(); history = undefined })
  }
  return history
}
export function registerBrowserTools(host: WebContents) {
  store().prune()
  const guest = (id: number, allowTransit = false) => {
    const target = webContents.fromId(id)
    if (!target || target.hostWebContents !== host || (target.session !== session.fromPartition("persist:vessel-browser") && !(allowTransit && target.session === session.fromPartition("persist:vessel-transit")))) throw new Error("浏览器页面无效")
    return target
  }
  host.ipc.handle("browser:history:list", () => store().list())
  host.ipc.handle("browser:history:delete", (_event, id: number | null) => store().delete(id))
  host.ipc.handle("browser:print", (_event, id: number) => new Promise<void>((resolve, reject) => guest(id).print({ silent: false, printBackground: true }, (success, reason) => { if (success || /cancel/i.test(reason)) resolve(); else reject(new Error(reason)) })))
  const agents = new Map<number, string>()
  host.ipc.handle("browser:emulate", (_event, id: number, device: BrowserDevice | null) => {
    const target = guest(id, true)
    if (!device) { target.disableDeviceEmulation(); if (agents.has(id)) target.setUserAgent(agents.get(id)!); agents.delete(id); return }
    if (![device.width, device.height, device.deviceScaleFactor].every(Number.isFinite) || device.width < 100 || device.height < 100 || device.width > 10000 || device.height > 10000 || device.deviceScaleFactor < 0.1 || device.deviceScaleFactor > 10 || typeof device.userAgent !== "string" || device.userAgent.length > 2000) throw new Error("设备参数无效")
    if (!agents.has(id)) agents.set(id, target.getUserAgent())
    target.setUserAgent(device.userAgent || agents.get(id)!)
    target.enableDeviceEmulation({ screenPosition: device.mobile ? "mobile" : "desktop", screenSize: { width: device.width, height: device.height }, viewSize: { width: device.width, height: device.height }, viewPosition: { x: 0, y: 0 }, deviceScaleFactor: device.deviceScaleFactor, scale: 1 })
  })
  host.on("did-attach-webview", (_event, view) => {
    if (view.session !== session.fromPartition("persist:vessel-browser")) return
    let visit: number | undefined
    // Commit after navigation settles so redirects do not become separate visits.
    let pending: ReturnType<typeof setTimeout> | undefined
    const record = () => {
      clearTimeout(pending)
      pending = setTimeout(() => { if (!view.isDestroyed()) { visit = store().add(view.getURL(), view.getTitle() || view.getURL()); if (visit && favicon) store().favicon(visit, favicon) } }, 500)
    }
    view.on("did-start-navigation", (_event, _url, _inPlace, main) => { if (main) { clearTimeout(pending); visit = undefined; favicon = "" } })
    view.on("did-stop-loading", record)
    view.on("did-navigate-in-page", (_event, _url, main) => { if (main) record() })
    let favicon = ""
    view.on("page-title-updated", (_event, title) => { if (visit) store().title(visit, title) })
    view.on("page-favicon-updated", (_event, urls) => { favicon = urls[0] || ""; if (visit && favicon) store().favicon(visit, favicon) })
    view.once("destroyed", () => { clearTimeout(pending); agents.delete(view.id) })
  })
}
