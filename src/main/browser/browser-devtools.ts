import jakartaPath from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?asset"
import { matchesShortcut } from "@vessel/utils"
import { BrowserWindow, WebContentsView, webContents, type WebContents } from "electron"
import { join } from "node:path"
import { readFileSync } from "node:fs"

/** 将指定 guest 的 DevTools 挂到宿主窗口指定的预留区域。 */
export function registerBrowserDevtools(host: WebContents) {
  let panel: WebContentsView | undefined
  let detachedWindow: BrowserWindow | undefined
  let inspected: WebContents | undefined
  let appearance = { font: "Menlo", size: 13 }
  let cssKey: string | undefined
  let controlState = ""

  /** Applies appearance. */
  const applyAppearance = async () => {
    const target = panel?.webContents
    if (!target || target.isDestroyed()) return
    target.setZoomFactor(appearance.size / 13)
    if (cssKey) await target.removeInsertedCSS(cssKey)
    const family = appearance.font === "system-ui" || appearance.font === "monospace" ? appearance.font : JSON.stringify(appearance.font)
    cssKey = await target.insertCSS(
      `@font-face { font-family: "Plus Jakarta Sans"; src: url(data:font/woff2;base64,${readFileSync(jakartaPath).toString("base64")}) format("woff2"); } :root, body { --monospace-font-family: ${family}, monospace !important; --source-code-font-family: ${family}, monospace !important; --default-font-family: ${family}, monospace !important; font-family: ${family}, monospace !important; }`
    )
  }

  /** Closes close. */
  const close = () => {
    if (inspected && !inspected.isDestroyed()) {
      inspected.removeListener("destroyed", close)
      inspected.closeDevTools()
    }
    if (panel) {
      ;(detachedWindow || BrowserWindow.fromWebContents(host))?.contentView.removeChildView(panel)
      if (!panel.webContents.isDestroyed()) panel.webContents.close()
    }
    const detached = detachedWindow
    detachedWindow = undefined
    if (detached && !detached.isDestroyed()) detached.destroy()
    controlState = ""
    cssKey = undefined
    panel = undefined
    inspected = undefined
  }
  host.ipc.handle("browser:devtools", (_event, id: number | null, bounds?: Electron.Rectangle, options?: { font: string; size: number; detached?: boolean; hidden?: boolean; inspect?: { x: number; y: number }; control?: { x: number; y: number; width: number; height: number; icon: string; color: string; background: string; border: string; shadow: string } }) => {
    if (id === null) {
      close()
      return
    }
    const guest = webContents.fromId(id)
    const window = BrowserWindow.fromWebContents(host)
    if (!guest || guest.hostWebContents !== host || !window) throw new Error("无法打开当前网页控制台")
    if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) throw new Error("控制台区域无效")
    const appearanceChanged = options && (appearance.font !== options.font || appearance.size !== options.size)
    if (options) {
      if (!["Plus Jakarta Sans", "Menlo", "Consolas", "Courier New", "monospace", "system-ui"].includes(options.font) || ![11, 12, 13, 14, 16, 18, 20].includes(options.size)) throw new Error("控制台字体设置无效")
      appearance = { font: options.font, size: options.size }
    }
    if (inspected !== guest || !panel || Boolean(detachedWindow) !== Boolean(options?.detached)) {
      close()
      inspected = guest
      panel = new WebContentsView({ webPreferences: { session: guest.session, preload: join(__dirname, "../preload/browser-devtools.js"), sandbox: true, contextIsolation: true, nodeIntegration: false } })
      panel.webContents.ipc.on("browser:devtools-control", (_event, delta?: { dx: number; dy: number }) => {
        if (delta && ![delta.dx, delta.dy].every(Number.isFinite)) return
        if (!host.isDestroyed() && panel?.getVisible() && !detachedWindow) host.send("browser:control", delta)
      })
      panel.webContents.on("did-finish-load", () => {
        panel?.webContents.send("browser:control-overlay", controlState ? JSON.parse(controlState) : undefined)
        void applyAppearance().catch(console.error)
      })
      // F12 inside the DevTools panel itself toggles (closes) it through the same renderer path as the page/toolbar.
      const inspectedId = guest.id
      panel.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown" || !matchesShortcut(input, "devtools")) return
        event.preventDefault()
        if (!input.isAutoRepeat && !host.isDestroyed()) host.send("browser:toggle-devtools", inspectedId)
      })
      if (options?.detached) {
        detachedWindow = new BrowserWindow({ width: 1000, height: 600, title: "Vessel · 网页控制台", parent: window, skipTaskbar: true, autoHideMenuBar: true, webPreferences: { sandbox: true, nodeIntegration: false } })
        detachedWindow.contentView.addChildView(panel)

        /** Resizes resize. */
        const resize = () => {
          if (detachedWindow && panel) {
            const [width, height] = detachedWindow.getContentSize()
            panel.setBounds({ x: 0, y: 0, width, height })
          }
        }
        detachedWindow.on("resize", resize)
        detachedWindow.on("close", (event) => {
          event.preventDefault()
          close()
          if (!host.isDestroyed()) host.send("browser:devtools-closed")
        })
        resize()
      } else window.contentView.addChildView(panel)
      guest.setDevToolsWebContents(panel.webContents)
      guest.openDevTools({ mode: "detach", activate: false })
      guest.once("destroyed", close)
    }
    if (appearanceChanged) void applyAppearance().catch(console.error)
    // Keep DevTools alive (preserving its network log) while the browser page is hidden.
    const hidden = options?.hidden === true
    panel.setVisible(!hidden)
    if (detachedWindow) {
      if (hidden) detachedWindow.hide()
      else if (!detachedWindow.isVisible()) detachedWindow.showInactive()
      return
    }
    if (hidden) return
    if (options?.inspect && [options.inspect.x, options.inspect.y].every(Number.isFinite)) {
      guest.inspectElement(Math.max(0, Math.round(options.inspect.x)), Math.max(0, Math.round(options.inspect.y)))
    }
    const control = options?.control
    const factor = appearance.size / 13
    const overlay = control && [control.x, control.y, control.width, control.height].every(Number.isFinite)
      ? { ...control, x: control.x / factor, y: control.y / factor, width: control.width / factor, height: control.height / factor } : undefined
    const nextControl = JSON.stringify(overlay) || ""
    if (controlState !== nextControl || panel.webContents.isLoading()) {
      controlState = nextControl
      panel.webContents.send("browser:control-overlay", overlay)
    }
    const size = window.getContentBounds()
    const x = Math.max(0, Math.round(bounds.x)),
      y = Math.max(0, Math.round(bounds.y))
    panel.setBounds({ x, y, width: Math.max(0, Math.min(Math.round(bounds.width), size.width - x)), height: Math.max(0, Math.min(Math.round(bounds.height), size.height - y)) })
  })
  let catalog: WebContentsView | undefined
  let devices: Promise<import("@vessel/type").BrowserDevice[]> | undefined
  let devicesAt = 0
  host.once("destroyed", () => {
    if (catalog && !catalog.webContents.isDestroyed()) catalog.webContents.close()
    devices = undefined
  })
  const readDevices = (target: WebContents) => target.executeJavaScript(`(async () => {
    let module;
    try { module = await import('../models/emulation/emulation.js') } catch { module = await import('../panels/emulation/emulation.js') }
    const list = module.EmulatedDevices.EmulatedDevicesList.instance();
    return [...list.standard(), ...list.custom()].map(device => ({title: device.title, width: device.vertical.width, height: device.vertical.height, deviceScaleFactor: device.deviceScaleFactor, mobile: device.capabilities.includes('mobile'), userAgent: device.userAgent}));
  })()`)
  host.ipc.handle("browser:devices", () => {
    if (panel && !panel.webContents.isDestroyed()) return readDevices(panel.webContents)
    if (devices && Date.now() - devicesAt < 60_000) return devices
    // Cache the small plain device list, not an entire hidden DevTools renderer.
    devicesAt = Date.now()
    devices = (async () => {
      const view = new WebContentsView({ webPreferences: { partition: "persist:vessel-browser", sandbox: true, contextIsolation: true, nodeIntegration: false } })
      catalog = view
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([
          (async () => {
            await view.webContents.loadURL("devtools://devtools/bundled/inspector.html")
            return await readDevices(view.webContents)
          })(),
          new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("读取设备列表超时")), 15_000) })
        ])
      } finally {
        clearTimeout(timer)
        if (!view.webContents.isDestroyed()) view.webContents.close()
        if (catalog === view) catalog = undefined
      }
    })().catch((error) => { devices = undefined; throw error })
    return devices
  })
  host.once("destroyed", close)
}
