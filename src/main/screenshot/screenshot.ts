import { registerPinMenu, togglePins } from "@main/screenshot/pin-menu"
import { fullscreenPreviewWindow } from "./preview-fullscreen"
import { translateScreenshot } from "@main/screenshot/translate"
import { generalSettings, settingsEvents } from "@main/settings/settings"
import { app, BrowserWindow, clipboard, desktopCapturer, dialog, globalShortcut, nativeImage, screen, shell, systemPreferences } from "electron"
import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
let captureWindow: BrowserWindow | undefined
let capturing = false
const pins = new Set<BrowserWindow>()

/** Loads load. */
function load(win: BrowserWindow) {
  const url = process.env.ELECTRON_RENDERER_URL
  return url ? win.loadURL(`${url}/screenshot.html`) : win.loadFile(join(__dirname, "../renderer/screenshot.html"))
}

/** Creates create. */
function create(bounds: Electron.Rectangle, resizable = true) {
  const win = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    hasShadow: resizable,
    resizable,
    // Both capture overlays and pins must float above other apps, including full-screen Spaces.
    ...(process.platform === "darwin" ? { type: "panel" as const, fullscreenable: false, acceptFirstMouse: true } : {}),
    enableLargerThanScreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#ffffff",
    webPreferences: { preload: join(__dirname, "../preload/screenshot.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  // macOS 会把普通窗口约束在菜单栏下方，导致截图窗口整体下移、露出系统菜单栏；放开约束后强制贴合屏幕边界。
  win.setBounds(bounds)
  win.setAlwaysOnTop(true, "screen-saver")
  // Avoid TransformProcessType: it briefly hides macOS windows and the Dock.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  win.webContents.on("will-navigate", (e) => e.preventDefault())
  win.webContents.ipc.handle("shot:close", () => win.close())
  win.webContents.ipc.handle("shot:translate", (_event, text: unknown, target: unknown) => translateScreenshot(text, target))
  win.webContents.ipc.handle("shot:copy-text", (_event, text: string) => {
    if (typeof text !== "string" || text.length > 1024 * 1024) throw new Error("文字数据无效")
    clipboard.writeText(text)
  })
  return win
}

/** Performs the capture display operation. */
async function captureDisplay(display: Electron.Display): Promise<string> {
  // Do not attempt a second capture backend when macOS has denied consent.
  if (process.platform === "darwin" && ["denied", "restricted"].includes(systemPreferences.getMediaAccessStatus("screen"))) throw new Error("屏幕录制权限未开启")
  if (process.platform === "darwin" && systemPreferences.getMediaAccessStatus("screen") === "granted") {
    const directory = await mkdtemp(join(tmpdir(), "vessel-capture-"))
    try {
      const file = join(directory, "screen.png")
      const { x, y, width, height } = display.bounds
      // Capture the composed desktop, including window shadows and rounded corners.
      await promisify(execFile)("/usr/sbin/screencapture", ["-x", "-R", `${x},${y},${width},${height}`, file], { timeout: 10000 })
      const image = nativeImage.createFromPath(file)
      if (image.isEmpty()) throw new Error("系统未返回有效截图")
      return image.toDataURL()
    } catch (error) {
      console.warn("[screenshot] Native capture unavailable, falling back to Electron", error)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: Math.round(display.size.width * display.scaleFactor), height: Math.round(display.size.height * display.scaleFactor) } })
  const source = sources.find((s) => s.display_id === String(display.id)) || (sources.length === 1 ? sources[0] : undefined)
  if (!source || source.thumbnail.isEmpty()) throw new Error("没有可用的屏幕画面")
  return source.thumbnail.toDataURL()
}

/** Starts screenshot. */
export async function startScreenshot(previewSource?: Electron.WebContents) {
  if (capturing) return
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.focus()
    return
  }
  capturing = true
  try {
    const previewBounds = previewSource ? await fullscreenPreviewWindow(previewSource) : undefined
    const display = previewBounds ? screen.getDisplayMatching(previewBounds) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    // capturePage reads our own renderer surface and never requests desktop recording permission.
    const image = previewSource ? (await previewSource.capturePage()).toDataURL() : await captureDisplay(display)
    const win = create(display.bounds, false)
    captureWindow = win
    let shown = false
    win.webContents.ipc.handle("shot:ready", () => {
      if (!shown && !win.isDestroyed()) {
        shown = true
        // A macOS nonactivating panel can receive keyboard input without activating Vessel.
        win.show()
      }
    })
    win.webContents.ipc.handle("shot:data", () => ({ mode: "capture", image }))
    let finishing = false
    win.webContents.ipc.handle("shot:finish", async (_event, data: string, pinned?: boolean) => {
      if (typeof data !== "string" || !data.startsWith("data:image/png;base64,") || data.length > 100 * 1024 * 1024) throw new Error("截图数据无效")
      if (finishing) return
      finishing = true
      try {
        const img = nativeImage.createFromDataURL(data)
        if (img.isEmpty()) throw new Error("截图为空")
        clipboard.writeImage(img)
        if (!pinned) {
          if (!win.isDestroyed()) win.close()
          return
        }
        const size = img.getSize()
        const ratio = Math.min(1 / display.scaleFactor, display.workArea.width / size.width, display.workArea.height / size.height)
        const pin = create({ x: display.workArea.x + 40, y: display.workArea.y + 40, width: Math.max(180, Math.round(size.width * ratio)), height: Math.max(100, Math.round(size.height * ratio)) })
        registerPinMenu(pin, img, pins)
        pins.add(pin)
        pin.on("closed", () => pins.delete(pin))
        pin.webContents.ipc.handle("shot:data", () => ({ mode: "pin", image: data }))
        pin.webContents.ipc.handle("shot:copy", () => clipboard.writeImage(img))
        await load(pin)
        pin.showInactive()
        if (!win.isDestroyed()) win.close()
      } finally {
        finishing = false
      }
    })
    win.on("closed", () => {
      captureWindow = undefined
    })
    await load(win)
  } catch (error) {
    captureWindow?.close()
    if (previewSource) {
      console.error("[screenshot] Preview failed", error)
      dialog.showErrorBox("模拟截图失败", error instanceof Error ? error.message : String(error))
      return
    }
    const permission = process.platform === "darwin" ? systemPreferences.getMediaAccessStatus("screen") : undefined
    console.error("[screenshot] Capture failed", { permission, error })
    if (permission && permission !== "granted") {
      const { response } = await dialog.showMessageBox({
        type: "warning",
        title: "需要屏幕录制权限",
        message: "请允许 Vessel 录制屏幕",
        detail: "在系统设置 → 隐私与安全性 → 屏幕与系统音频录制中开启权限，然后完全退出并重新打开 Vessel。开发模式可能显示为 Electron 或启动它的终端。",
        buttons: ["打开系统设置", "取消"],
        cancelId: 1
      })
      if (response === 0) await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
    } else {
      dialog.showErrorBox("截图失败", "无法获取屏幕画面，请确认屏幕未锁定后重试。若刚修改录屏权限，请完全退出并重新打开 Vessel。\n" + (error instanceof Error ? error.message : String(error)))
    }
  } finally {
    capturing = false
  }
}

/** Registers screenshot shortcut. */
export function registerScreenshotShortcut() {
  const keys = [process.platform === "darwin" ? "Control+X" : "F1"]
  const registered = new Set<string>()

  /** Refreshes the current state. */
  const update = () => {
    for (const key of registered) globalShortcut.unregister(key)
    registered.clear()
    if (generalSettings().externalScreenshot === false) return
    if (globalShortcut.register("Alt+Shift+P", () => togglePins(pins))) registered.add("Alt+Shift+P")
    for (const key of keys) {
      if (globalShortcut.register(key, () => void startScreenshot())) registered.add(key)
      else console.warn(`截图快捷键已被占用：${key}`)
    }
  }
  update()
  settingsEvents.on("changed", update)
  app.once("will-quit", () => {
    settingsEvents.off("changed", update)
    for (const key of registered) globalShortcut.unregister(key)
  })
}
