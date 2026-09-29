import { BrowserWindow, WebContentsView, webContents, type WebContents } from "electron"

/** 将指定 guest 的 DevTools 挂到宿主窗口底部的预留区域。 */
export function registerBrowserDevtools(host: WebContents) {
  let panel: WebContentsView | undefined
  let inspected: WebContents | undefined
  const close = () => {
    if (inspected && !inspected.isDestroyed()) { inspected.removeListener("destroyed", close); inspected.closeDevTools() }
    if (panel) {
      BrowserWindow.fromWebContents(host)?.contentView.removeChildView(panel)
      if (!panel.webContents.isDestroyed()) panel.webContents.close()
    }
    panel = undefined
    inspected = undefined
  }
  host.ipc.handle("browser:devtools", (_event, id: number | null, bounds?: Electron.Rectangle) => {
    if (id === null) { close(); return }
    const guest = webContents.fromId(id)
    const window = BrowserWindow.fromWebContents(host)
    if (!guest || guest.hostWebContents !== host || !window) throw new Error("无法打开当前网页控制台")
    if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) throw new Error("控制台区域无效")
    if (inspected !== guest || !panel) {
      close()
      inspected = guest
      panel = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
      window.contentView.addChildView(panel)
      guest.setDevToolsWebContents(panel.webContents)
      guest.openDevTools({ mode: "detach", activate: false })
      guest.once("destroyed", close)
    }
    const size = window.getContentBounds()
    const x = Math.max(0, Math.round(bounds.x)), y = Math.max(0, Math.round(bounds.y))
    panel.setBounds({ x, y, width: Math.max(0, Math.min(Math.round(bounds.width), size.width - x)), height: Math.max(0, Math.min(Math.round(bounds.height), size.height - y)) })
  })
  host.once("destroyed", close)
}
