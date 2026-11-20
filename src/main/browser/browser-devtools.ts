import { revealBrowserStyle } from "./browser-inspect-style"
import { bindBrowserDevtoolsWindow } from "./browser-devtools-window"
import { enableBrowserNodeScreenshots, registerBrowserNodeScreenshotSave } from "./browser-devtools-screenshot"
import { generalSettings, settingsEvents } from "@main/settings/settings"
import jakartaPath from "@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?asset"
import { matchesShortcut } from "@vessel/utils"
import { BrowserWindow, WebContentsView, webContents, type WebContents } from "electron"
import { join } from "node:path"
import { readFileSync } from "node:fs"

/** 将指定 guest 的 DevTools 挂到宿主窗口指定的预留区域。 */
export function registerBrowserDevtools(host: WebContents) {
  let panel: WebContentsView | undefined
  let detachedWindow: BrowserWindow | undefined
  let detachedBounds: Electron.Rectangle | undefined
  let syncDetachedWindow: (() => void) | undefined
  let stopFollowing: (() => void) | undefined
  let stopScreenshotSetup: (() => void) | undefined
  let originalThrottling: boolean | undefined
  let inspected: WebContents | undefined
  let appearance = { font: "Menlo", size: 13 }
  let cssKey: string | undefined
  let controlState = ""

  let previewRevision = 0
  let previewOccluded = false
  let previewCapturePending = false
  let appliedKey = ""
  let appliedBounds = ""
  let appliedVisible: boolean | undefined
  /** Applies appearance only when it really changed: re-injecting CSS / zoom on every layout sync blanks DevTools and collapses console objects. */
  const applyAppearance = async (force = false) => {
    const target = panel?.webContents
    if (!target || target.isDestroyed()) return
    const key = `${appearance.font}|${appearance.size}`
    if (!force && key === appliedKey && cssKey) return
    appliedKey = key
    target.setZoomFactor(appearance.size / 13)
    if (cssKey) await target.removeInsertedCSS(cssKey)
    const family = appearance.font === "system-ui" || appearance.font === "monospace" ? appearance.font : JSON.stringify(appearance.font)
    cssKey = await target.insertCSS(
      `@font-face { font-family: "Plus Jakarta Sans"; src: url(data:font/woff2;base64,${readFileSync(jakartaPath).toString("base64")}) format("woff2"); } :root, body { --monospace-font-family: ${family}, monospace !important; --source-code-font-family: ${family}, monospace !important; --default-font-family: ${family}, monospace !important; font-family: ${family}, monospace !important; }`
    )
  }

  /** Closes close. */
  const close = () => {
    previewRevision++
    previewOccluded = false
    previewCapturePending = false
    if (inspected && !host.isDestroyed()) host.send("browser:devtools-preview", { id: inspected.id })
    stopScreenshotSetup?.()
    stopScreenshotSetup = undefined
    stopFollowing?.()
    stopFollowing = undefined
    syncDetachedWindow = undefined
    if (inspected && !inspected.isDestroyed()) {
      if (originalThrottling !== undefined) inspected.setBackgroundThrottling(originalThrottling)
      inspected.removeListener("destroyed", close)
      inspected.closeDevTools()
    }
    if (panel) {
      ;(detachedWindow || BrowserWindow.fromWebContents(host))?.contentView.removeChildView(panel)
      if (!panel.webContents.isDestroyed()) panel.webContents.close()
    }
    const detached = detachedWindow
    if (detached && !detached.isDestroyed()) detachedBounds = detached.getNormalBounds()
    detachedWindow = undefined
    if (detached && !detached.isDestroyed()) detached.destroy()
    controlState = ""
    cssKey = undefined
    appliedKey = ""
    appliedBounds = ""
    appliedVisible = undefined
    panel = undefined
    inspected = undefined
    originalThrottling = undefined
  }
  host.ipc.handle("browser:devtools", (_event, id: number | null, bounds?: Electron.Rectangle, options?: { font: string; size: number; detached?: boolean; hidden?: boolean; occluded?: boolean; pageTitle?: string; pageURL?: string; inspect?: { x: number; y: number; property?: string; targetKey?: string }; control?: { x: number; y: number; width: number; height: number; icon: string; color: string; background: string; border: string; shadow: string } }) => {
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
    if (inspected !== guest || !panel) {
      close()
      inspected = guest
      panel = new WebContentsView({ webPreferences: { session: guest.session, preload: join(__dirname, "../preload/browser-devtools.js"), sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } })
      registerBrowserNodeScreenshotSave(panel.webContents, host, () => detachedWindow || BrowserWindow.fromWebContents(host) || undefined)
      panel.webContents.ipc.on("browser:devtools-control", (_event, delta?: { dx: number; dy: number }) => {
        if (delta && ![delta.dx, delta.dy].every(Number.isFinite)) return
        if (!host.isDestroyed() && panel?.getVisible() && !detachedWindow) host.send("browser:control", delta)
      })
      panel.webContents.on("did-finish-load", () => {
        panel?.webContents.send("browser:control-overlay", controlState ? JSON.parse(controlState) : undefined)
        // A fresh page has none of the injected CSS yet.
        cssKey = undefined
        void applyAppearance(true).catch(console.error)
      })
      // F12 inside the DevTools panel itself toggles (closes) it through the same renderer path as the page/toolbar.
      const inspectedId = guest.id
      panel.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown" || !matchesShortcut(input, "devtools")) return
        event.preventDefault()
        if (!input.isAutoRepeat && !host.isDestroyed()) host.send("browser:toggle-devtools", inspectedId)
      })
      window.contentView.addChildView(panel)
      const frontend = panel.webContents
      const prepareScreenshots = () => { void enableBrowserNodeScreenshots(frontend).catch(console.error) }
      guest.on("devtools-opened", prepareScreenshots)
      stopScreenshotSetup = () => guest.removeListener("devtools-opened", prepareScreenshots)
      guest.setDevToolsWebContents(panel.webContents)
      guest.openDevTools({ mode: "detach", activate: false })
      guest.once("destroyed", close)
    }
    // Move the existing DevTools view between windows without restarting its session.
    if (Boolean(detachedWindow) !== Boolean(options?.detached)) {
      appliedBounds = ""
      if (options?.detached) {
        window.contentView.removeChildView(panel)
        originalThrottling = guest.getBackgroundThrottling()
        guest.setBackgroundThrottling(false)
        detachedWindow = new BrowserWindow({ width: 1000, height: 600, ...detachedBounds, title: "网页控制台", show: false, fullscreen: false, fullscreenable: false, skipTaskbar: true, autoHideMenuBar: true, webPreferences: { sandbox: true, nodeIntegration: false, backgroundThrottling: false } })
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
        const follower = bindBrowserDevtoolsWindow(window, detachedWindow, () => generalSettings().browserDevtoolsFollowWindow === true, () => appliedVisible === false)
        syncDetachedWindow = follower.sync
        settingsEvents.on("changed", follower.sync)
        stopFollowing = () => {
          settingsEvents.removeListener("changed", follower.sync)
          follower.dispose()
        }
      } else {
        stopFollowing?.()
        stopFollowing = undefined
        syncDetachedWindow = undefined
        const detached = detachedWindow!
        detachedBounds = detached.getNormalBounds()
        detached.contentView.removeChildView(panel)
        detachedWindow = undefined
        window.contentView.addChildView(panel)
        detached.destroy()
        if (originalThrottling !== undefined) guest.setBackgroundThrottling(originalThrottling)
        originalThrottling = undefined
      }
    }
    if (appearanceChanged) void applyAppearance().catch(console.error)
    // Keep DevTools alive (preserving its network log) while the browser page is hidden.
    const hidden = options?.hidden === true
    // Preserve the last console frame underneath DOM portals while its native view is hidden.
    const occluded = hidden && options?.occluded === true && !detachedWindow
    if (occluded !== previewOccluded) {
      previewOccluded = occluded
      const revision = ++previewRevision
      if (occluded) {
        const capturedPanel = panel
        previewCapturePending = true
        void capturedPanel.webContents.capturePage().then(image => {
          if (revision === previewRevision && !host.isDestroyed()) host.send("browser:devtools-preview", { id: guest.id, image: image.toDataURL() })
        }).catch(console.error).finally(() => {
          if (revision !== previewRevision) return
          previewCapturePending = false
          if (panel === capturedPanel && !capturedPanel.webContents.isDestroyed()) capturedPanel.setVisible(false)
        })
      } else {
        previewCapturePending = false
        if (!host.isDestroyed()) host.send("browser:devtools-preview", { id: guest.id })
      }
    }
    if (appliedVisible !== !hidden || (hidden && !previewCapturePending && panel.getVisible())) {
      appliedVisible = !hidden
      if (!hidden || !previewCapturePending) panel.setVisible(!hidden)
    }
    const inspect = options?.inspect
    if (!hidden && inspect?.property && inspect.targetKey && /^[-a-zA-Z0-9_]{1,160}$/.test(inspect.property) && /^__vesselStyleTarget_[a-z0-9]{1,30}$/.test(inspect.targetKey)) {
      void revealBrowserStyle(panel.webContents, inspect.targetKey, inspect.property).catch(console.error)
    }
    if (!hidden && inspect && !inspect.targetKey && [inspect.x, inspect.y].every(Number.isFinite)) {
      guest.inspectElement(Math.max(0, Math.round(inspect.x)), Math.max(0, Math.round(inspect.y)))
    }
    if (detachedWindow) {
      if (controlState) {
        controlState = ""
        panel.webContents.send("browser:control-overlay", undefined)
      }
      detachedWindow.setTitle(`${options?.pageTitle || guest.getTitle() || "网页"} · ${options?.pageURL ?? guest.getURL()}`)
      syncDetachedWindow?.()
      return
    }
    if (hidden) return
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
    const next = { x, y, width: Math.max(0, Math.min(Math.round(bounds.width), size.width - x)), height: Math.max(0, Math.min(Math.round(bounds.height), size.height - y)) }
    const nextKey = `${next.x},${next.y},${next.width},${next.height}`
    // Identical bounds would only make DevTools re-layout (and drop expanded console objects) for nothing.
    if (nextKey !== appliedBounds) {
      appliedBounds = nextKey
      panel.setBounds(next)
    }
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
