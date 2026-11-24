import { isPrivateBrowserSession } from "./browser-private"
import { readBrowserSource } from "./browser-source"
import { browserFilePreview } from "../../shared/browser-preview"
import { browserImageAction } from "./browser-image-actions"
import { BrowserHistory } from "@main/browser/browser-history"
import { notifyBrowserFileSaved, registerBrowserDownloads } from "./browser-downloads"
import type { BrowserDevice } from "@vessel/type"
import { app, BrowserWindow, dialog, session, shell, webContents, type WebContents } from "electron"
import { join } from "node:path"
import { access, stat } from "node:fs/promises"
import { fileURLToPath, pathToFileURL } from "node:url"
let history: BrowserHistory | undefined

/** Performs the store operation. */
function store() {
  if (!history) {
    history = new BrowserHistory(join(app.getPath("userData"), "browser-history.sqlite"))
    const timer = setInterval(() => history?.prune(), 3600000)
    timer.unref()
    app.once("will-quit", () => {
      clearInterval(timer)
      history?.close()
      history = undefined
    })
  }
  return history
}

/** Returns browser bookmarks. */
export function getBrowserBookmarks() {
  return store().getBookmarks()
}

/** Sets browser bookmarks. */
export function setBrowserBookmarks(items: { url: string; title: string }[]) {
  return store().setBookmarks(items)
}

/** Registers browser tools. */
export function registerBrowserTools(host: WebContents) {
  store().prune()
  registerBrowserDownloads(host, (path, name, size, source) => {
    store().addDownload(path, name, size, source)
    host.send("browser:downloads-updated")
  })
  host.ipc.handle("browser:downloads:list", () => store().listDownloads())
  const downloadedFile = async (id: number) => {
    const entry = store().getDownload(id)
    if (!entry || !(await stat(entry.path).catch(() => undefined))?.isFile()) throw new Error("文件已移动或删除")
    return entry
  }
  host.ipc.handle("browser:downloads:preview", async (_event, id: number) => {
    const entry = await downloadedFile(id)
    if (!browserFilePreview(entry.name)) throw new Error("浏览器不支持预览此文件")
    return pathToFileURL(entry.path).href
  })
  host.ipc.handle("browser:downloads:reveal", async (_event, id: number) => {
    shell.showItemInFolder((await downloadedFile(id)).path)
  })

  /** Performs the guest operation. */
  const guest = (id: number, allowTransit = false) => {
    const target = webContents.fromId(id)
    if (!target || target.hostWebContents !== host || (target.session !== session.fromPartition("persist:vessel-browser") && !isPrivateBrowserSession(host, target.session) && !(allowTransit && target.session === session.fromPartition("persist:vessel-transit")))) throw new Error("浏览器页面无效")
    return target
  }
  host.ipc.handle("browser:page-action", async (_event, id: number, action: string) => {
    const target = guest(id)
    if (action === "copy-image" || action === "download-image") {
      await browserImageAction(host, target, action)
      return
    }
    if (action === "reveal") {
      const url = new URL(target.getURL())
      if (url.protocol !== "file:") throw new Error("当前网页不是本地资源")
      const path = fileURLToPath(url)
      await access(path).catch(() => { throw new Error("本地资源不存在或无法访问") })
      shell.showItemInFolder(path)
      return
    }
    if (action === "save") {
      const result = await dialog.showSaveDialog({ defaultPath: "page.html", filters: [{ name: "HTML 网页", extensions: ["html"] }] })
      if (!result.canceled && result.filePath && !target.isDestroyed()) {
        await target.savePage(result.filePath, "HTMLOnly")
        if (!isPrivateBrowserSession(host, target.session)) await notifyBrowserFileSaved(host, result.filePath, "save")
      }
      return
    }
    if (action === "source") return readBrowserSource(target)
    throw new Error("不支持的网页操作")
  })
  host.ipc.handle("browser:bookmarks:sync", (_event, items) => {
    const valid = Array.isArray(items) ? items.filter((item) => item && typeof item.url === "string" && /^https?:\/\//i.test(item.url)).map((item) => ({ url: item.url, title: String(item.title || item.url) })) : []
    store().setBookmarks(valid)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("browser:bookmarks-updated", valid)
      }
    }
    return valid
  })
  host.ipc.handle("browser:bookmarks:get", () => store().getBookmarks())
  host.ipc.handle("browser:history:list", () => store().list())
  host.ipc.handle("browser:history:delete", (_event, id: number | null) => store().delete(id))
  host.ipc.handle(
    "browser:print",
    (_event, id: number) =>
      new Promise<void>((resolve, reject) =>
        guest(id).print({ silent: false, printBackground: true }, (success, reason) => {
          if (success || /cancel/i.test(reason)) resolve()
          else reject(new Error(reason))
        })
      )
  )
  const agents = new Map<number, string>()
  host.ipc.handle("browser:emulate", (_event, id: number, device: BrowserDevice | null) => {
    const target = guest(id, true)
    if (!device) {
      target.disableDeviceEmulation()
      if (agents.has(id)) target.setUserAgent(agents.get(id)!)
      agents.delete(id)
      return
    }
    if (
      ![device.width, device.height, device.deviceScaleFactor].every(Number.isFinite) ||
      device.width < 100 ||
      device.height < 100 ||
      device.width > 10000 ||
      device.height > 10000 ||
      device.deviceScaleFactor < 0.1 ||
      device.deviceScaleFactor > 10 ||
      typeof device.userAgent !== "string" ||
      device.userAgent.length > 2000
    )
      throw new Error("设备参数无效")
    if (!agents.has(id)) agents.set(id, target.getUserAgent())
    target.setUserAgent(device.userAgent || agents.get(id)!)
    target.enableDeviceEmulation({ screenPosition: device.mobile ? "mobile" : "desktop", screenSize: { width: device.width, height: device.height }, viewSize: { width: device.width, height: device.height }, viewPosition: { x: 0, y: 0 }, deviceScaleFactor: device.deviceScaleFactor, scale: 1 })
  })
  host.on("did-attach-webview", (_event, view) => {
    if (view.session !== session.fromPartition("persist:vessel-browser")) return
    let visit: number | undefined
    // Commit after navigation settles so redirects do not become separate visits.
    let pending: ReturnType<typeof setTimeout> | undefined

    /** Performs the record operation. */
    const record = () => {
      clearTimeout(pending)
      pending = setTimeout(() => {
        if (!view.isDestroyed()) {
          visit = store().add(view.getURL(), view.getTitle() || view.getURL())
          if (visit && favicon) store().favicon(visit, favicon)
        }
      }, 500)
    }
    view.on("did-start-navigation", (_event, _url, _inPlace, main) => {
      if (main) {
        clearTimeout(pending)
        visit = undefined
        favicon = ""
      }
    })
    view.on("did-stop-loading", record)
    view.on("did-navigate-in-page", (_event, _url, main) => {
      if (main) record()
    })
    let favicon = ""
    view.on("page-title-updated", (_event, title) => {
      if (visit) store().title(visit, title)
    })
    view.on("page-favicon-updated", (_event, urls) => {
      favicon = urls[0] || ""
      if (visit && favicon) store().favicon(visit, favicon)
    })
    view.once("destroyed", () => {
      clearTimeout(pending)
      agents.delete(view.id)
    })
  })
}
