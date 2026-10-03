import { readFileSync } from "node:fs"
import jakartaPath from "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?asset"
import { BrowserWindow, WebContentsView, webContents, type WebContents } from "electron"

/** 将指定 guest 的 DevTools 挂到宿主窗口指定的预留区域。 */
export function registerBrowserDevtools(host: WebContents) {
  let panel: WebContentsView | undefined
  let detachedWindow: BrowserWindow | undefined
  let inspected: WebContents | undefined
  let appearance = { font: "Menlo", size: 13 }
  let cssKey: string | undefined
  const applyAppearance = async () => {
    const target = panel?.webContents
    if (!target || target.isDestroyed()) return
    target.setZoomFactor(appearance.size / 13)
    if (cssKey) await target.removeInsertedCSS(cssKey)
    const family = appearance.font === "system-ui" || appearance.font === "monospace" ? appearance.font : JSON.stringify(appearance.font)
    cssKey = await target.insertCSS(`@font-face { font-family: "Plus Jakarta Sans"; src: url(data:font/woff2;base64,${readFileSync(jakartaPath).toString("base64")}) format("woff2"); } :root, body { --monospace-font-family: ${family}, monospace !important; --source-code-font-family: ${family}, monospace !important; --default-font-family: ${family}, monospace !important; font-family: ${family}, monospace !important; }`)
  }
  const close = () => {
    if (inspected && !inspected.isDestroyed()) { inspected.removeListener("destroyed", close); inspected.closeDevTools() }
    if (panel) {
      (detachedWindow || BrowserWindow.fromWebContents(host))?.contentView.removeChildView(panel)
      if (!panel.webContents.isDestroyed()) panel.webContents.close()
    }
    const detached = detachedWindow
    detachedWindow = undefined
    if (detached && !detached.isDestroyed()) detached.destroy()
    cssKey = undefined
    panel = undefined
    inspected = undefined
  }
  host.ipc.handle("browser:devtools", (_event, id: number | null, bounds?: Electron.Rectangle, options?: { font: string; size: number; detached?: boolean }) => {
    if (id === null) { close(); return }
    const guest = webContents.fromId(id)
    const window = BrowserWindow.fromWebContents(host)
    if (!guest || guest.hostWebContents !== host || !window) throw new Error("无法打开当前网页控制台")
    if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) throw new Error("控制台区域无效")
    if (options) {
      if (!["Plus Jakarta Sans", "Menlo", "Consolas", "Courier New", "monospace", "system-ui"].includes(options.font) || ![11, 12, 13, 14, 16, 18, 20].includes(options.size)) throw new Error("控制台字体设置无效")
      appearance = options
    }
    if (inspected !== guest || !panel || Boolean(detachedWindow) !== Boolean(options?.detached)) {
      close()
      inspected = guest
      panel = new WebContentsView({ webPreferences: { session: guest.session, sandbox: true, contextIsolation: true, nodeIntegration: false } })
      panel.webContents.on("did-finish-load", () => { void applyAppearance().catch(console.error) })
      if (options?.detached) {
        detachedWindow = new BrowserWindow({ width: 1000, height: 600, title: "Vessel · 网页控制台", parent: window, skipTaskbar: true, autoHideMenuBar: true, webPreferences: { sandbox: true, nodeIntegration: false } })
        detachedWindow.contentView.addChildView(panel)
        const resize = () => {
          if (detachedWindow && panel) { const [width, height] = detachedWindow.getContentSize(); panel.setBounds({ x: 0, y: 0, width, height }) }
        }
        detachedWindow.on("resize", resize)
        detachedWindow.on("close", event => { event.preventDefault(); close(); if (!host.isDestroyed()) host.send("browser:devtools-closed") })
        resize()
      } else window.contentView.addChildView(panel)
      guest.setDevToolsWebContents(panel.webContents)
      guest.openDevTools({ mode: "detach", activate: false })
      guest.once("destroyed", close)
    }
    void applyAppearance().catch(console.error)
    if (detachedWindow) return
    const size = window.getContentBounds()
    const x = Math.max(0, Math.round(bounds.x)), y = Math.max(0, Math.round(bounds.y))
    panel.setBounds({ x, y, width: Math.max(0, Math.min(Math.round(bounds.width), size.width - x)), height: Math.max(0, Math.min(Math.round(bounds.height), size.height - y)) })
  })
  let catalog: WebContentsView | undefined
  let catalogReady: Promise<void> | undefined
  host.once("destroyed", () => { if (catalog && !catalog.webContents.isDestroyed()) catalog.webContents.close() })
  host.ipc.handle("browser:devices", async () => {
    let target = panel?.webContents
    if (!target || target.isDestroyed()) {
      if (!catalog || catalog.webContents.isDestroyed()) {
        catalog = new WebContentsView({ webPreferences: { partition: "persist:vessel-browser", sandbox: true, contextIsolation: true, nodeIntegration: false } })
        catalogReady = catalog.webContents.loadURL("devtools://devtools/bundled/inspector.html")
      }
      await catalogReady
      target = catalog.webContents
    }
    return target.executeJavaScript(`(async () => {
      let module;
      try { module = await import('./models/emulation/emulation.js') } catch { module = await import('./panels/emulation/emulation.js') }
      const list = module.EmulatedDevices.EmulatedDevicesList.instance();
      return [...list.standard(), ...list.custom()].map(device => ({title: device.title, width: device.vertical.width, height: device.vertical.height, deviceScaleFactor: device.deviceScaleFactor, mobile: device.capabilities.includes('mobile'), userAgent: device.userAgent}));
    })()`)
  })
  host.once("destroyed", close)
}
