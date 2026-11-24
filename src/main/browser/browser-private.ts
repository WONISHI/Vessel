import { attachBrowserSessionProxy, detachBrowserSessionProxy } from "./browser-session-proxy"
import { session, webContents, type Session, type WebContents } from "electron"
import { randomUUID } from "node:crypto"
import { applyBrowserIdentity } from "./browser-identity"
import { registerBrowserSiteCompatibility } from "./browser-site-compatibility"

const windows = new Map<WebContents, { partition: string; session: Session; ready: Promise<void> }>()

export function isPrivateBrowserSession(host: WebContents, target: Session) {
  return windows.get(host)?.session === target
}

export function isPrivateBrowserPartition(host: WebContents, partition: string) {
  return windows.get(host)?.partition === partition
}

/** Allocate only in-memory sessions, scoped to their app host. Never accept renderer-chosen partitions. */
export function registerBrowserPrivate(host: WebContents) {
  const close = async () => {
    const current = windows.get(host)
    if (!current) return
    windows.delete(host)
    await current.ready.catch(() => {})
    detachBrowserSessionProxy(current.session)
    for (const guest of webContents.getAllWebContents()) {
      if (guest.session === current.session && !guest.isDestroyed()) guest.close({ waitForBeforeUnload: false })
    }
    await Promise.all([
      current.session.clearStorageData(), current.session.clearCache(),
      current.session.clearAuthCache(), current.session.closeAllConnections()
    ])
  }
  host.ipc.handle("browser:private:create", async (event) => {
    if (event.senderFrame !== host.mainFrame) throw new Error("无效的浏览器窗口")
    let current = windows.get(host)
    if (!current) {
      const partition = `vessel-private-${randomUUID()}`
      const browser = session.fromPartition(partition, { cache: false })
      applyBrowserIdentity(browser)
      registerBrowserSiteCompatibility(browser)
      current = { partition, session: browser, ready: attachBrowserSessionProxy(browser) }
      windows.set(host, current)
    }
    try {
      await current.ready
      if (host.isDestroyed() || windows.get(host) !== current) throw new Error("无痕窗口已关闭")
      return current.partition
    } catch (error) {
      if (windows.get(host) === current) await close()
      throw error
    }
  })
  host.ipc.handle("browser:private:close", async (event) => {
    if (event.senderFrame !== host.mainFrame) throw new Error("无效的浏览器窗口")
    await close()
  })
  host.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => {
    if (mainFrame && !inPlace) void close().catch(console.error)
  })
  host.once("destroyed", () => { void close().catch(console.error) })
}
