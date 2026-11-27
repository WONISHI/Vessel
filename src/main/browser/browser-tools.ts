import { assertDataClient, onDataDomainChanged, runDataOperation } from "@main/database/data-domain"
import { readBrowserFaviconData } from "./browser-favicon"
import { isPrivateBrowserSession } from "./browser-private"
import { readBrowserSource } from "./browser-source"
import { readBrowserFrames, registerFrameContextMenu } from "./browser-frames"
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
    const timer = setInterval(() => { void historyOperation(value => value.prune()).catch(console.error) }, 3600000)
    timer.unref()
    app.once("will-quit", () => {
      clearInterval(timer)
      history?.close()
      history = undefined
    })
  }
  return history
}

function historyOperation<T>(action: (history: BrowserHistory) => T) {
  const value = store()
  return runDataOperation(["browser-history.sqlite"], () => action(value))
}
/** Returns browser bookmarks. */
export function getBrowserBookmarks() {
  return historyOperation(value => value.getBookmarks())
}

/** Sets browser bookmarks. */
export function setBrowserBookmarks(items: { url: string; title: string }[]) {
  return historyOperation(value => value.setBookmarks(items))
}

/** Registers browser tools. */
export function registerBrowserTools(host: WebContents) {
  const handle = (channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) => host.ipc.handle(channel, (event, ...args) => { assertDataClient(event?.sender?.id); return listener(event, ...args) })
  void historyOperation(value => value.prune()).catch(console.error)
  registerBrowserDownloads(host, (path, name, size, source) => {
    void historyOperation(value => value.addDownload(path, name, size, source)).then(() => host.send("browser:downloads-updated")).catch(console.error)
  })
  handle("browser:downloads:list", () => historyOperation(value => value.listDownloads()))
  const downloadedFile = async (id: number) => {
    const entry = await historyOperation(value => value.getDownload(id))
    if (!entry || !(await stat(entry.path).catch(() => undefined))?.isFile()) throw new Error("文件已移动或删除")
    return entry
  }
  handle("browser:downloads:preview", async (_event, id: number) => {
    const entry = await downloadedFile(id)
    if (!browserFilePreview(entry.name)) throw new Error("浏览器不支持预览此文件")
    return pathToFileURL(entry.path).href
  })
  handle("browser:downloads:reveal", async (_event, id: number) => {
    shell.showItemInFolder((await downloadedFile(id)).path)
  })

  /** Performs the guest operation. */
  const guest = (id: number, allowTransit = false) => {
    const target = webContents.fromId(id)
    if (!target || target.hostWebContents !== host || (target.session !== session.fromPartition("persist:vessel-browser") && !isPrivateBrowserSession(host, target.session) && !(allowTransit && target.session === session.fromPartition("persist:vessel-transit")))) throw new Error("浏览器页面无效")
    return target
  }
  handle("browser:frames:list", (_event, id: number) => readBrowserFrames(guest(id)))
  handle("browser:page-action", async (_event, id: number, action: string) => {
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
  handle("browser:bookmarks:sync", async (_event, items) => {
    const valid = Array.isArray(items) ? items.filter((item) => item && typeof item.url === "string" && /^https?:\/\//i.test(item.url)).map((item) => ({ url: item.url, title: String(item.title || item.url) })) : []
    await historyOperation(value => value.setBookmarks(valid))
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("browser:bookmarks-updated", valid)
      }
    }
    return valid
  })
  handle("browser:bookmarks:get", () => historyOperation(value => value.getBookmarks()))
  handle("browser:history:list", () => historyOperation(value => value.list()))
  handle("browser:history:delete", (_event, id: number | null) => historyOperation(value => value.delete(id)))
  handle(
    "browser:print",
    (_event, id: number) =>
      new Promise<void>((resolve, reject) =>
        guest(id).print({ silent: false, printBackground: true }, (success, reason) => {
          if (success || /cancel/i.test(reason)) resolve()
          else reject(new Error(reason))
        })
      )
  )
  // Fetch through the guest's own session, so cross-origin icons can be sampled
  // without weakening canvas/CORS restrictions or changing the page's policies.
  handle("browser:favicon-data", async (_event, id: number, url: string) => {
    const target = guest(id)
    if (typeof url !== "string" || url.length > 65536 || !/^(https?:\/\/|data:image\/)/i.test(url)) return
    return readBrowserFaviconData(host, target, url, isPrivateBrowserSession(host, target.session))
  })
  const agents = new Map<number, string>()
  handle("browser:emulate", (_event, id: number, device: BrowserDevice | null) => {
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
    if (view.session === session.fromPartition("persist:vessel-browser") || isPrivateBrowserSession(host, view.session)) registerFrameContextMenu(view)
    if (view.session !== session.fromPartition("persist:vessel-browser")) return
    let visit: number | undefined
    const stopDomain = onDataDomainChanged(() => { visit = undefined; clearTimeout(pending) })
    // Commit after navigation settles so redirects do not become separate visits.
    let pending: ReturnType<typeof setTimeout> | undefined

    /** Performs the record operation. */
    const record = () => {
      clearTimeout(pending)
      pending = setTimeout(() => {
        if (!view.isDestroyed()) {
          const url = view.getURL(), title = view.getTitle() || url
          void historyOperation(value => {
            visit = value.add(url, title)
            if (visit && favicon) value.favicon(visit, favicon)
          }).catch(console.error)
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
      if (visit) { const id = visit; void historyOperation(value => value.title(id, title)).catch(console.error) }
    })
    view.on("page-favicon-updated", (_event, urls) => {
      favicon = urls[0] || ""
      if (visit && favicon) { const id = visit, icon = favicon; void historyOperation(value => value.favicon(id, icon)).catch(console.error) }
    })
    view.once("destroyed", () => {
      clearTimeout(pending)
      stopDomain()
      agents.delete(view.id)
    })
  })
}
