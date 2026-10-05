import { app, BrowserWindow, clipboard, desktopCapturer, dialog, globalShortcut, nativeImage, screen, systemPreferences, shell } from "electron"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
let captureWindow: BrowserWindow | undefined
let capturing = false
const pins = new Set<BrowserWindow>()
function load(win: BrowserWindow) {
  const url = process.env.ELECTRON_RENDERER_URL
  return url ? win.loadURL(`${url}/screenshot.html`) : win.loadFile(join(__dirname, "../renderer/screenshot.html"))
}
function create(bounds: Electron.Rectangle) {
  const win = new BrowserWindow({ ...bounds, show: false, frame: false, alwaysOnTop: true, skipTaskbar: true, backgroundColor: "#ffffff", webPreferences: { preload: join(__dirname, "../preload/screenshot.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  win.setAlwaysOnTop(true, "screen-saver")
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  win.webContents.on("will-navigate", (e) => e.preventDefault())
  win.webContents.ipc.handle("shot:close", () => win.close())
  return win
}
async function captureDisplay(display: Electron.Display): Promise<string> {
  // Do not attempt a second capture backend when macOS has denied consent.
  if (process.platform === "darwin" && ["denied", "restricted"].includes(systemPreferences.getMediaAccessStatus("screen"))) throw new Error("屏幕录制权限未开启")
  try {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: Math.round(display.size.width * display.scaleFactor), height: Math.round(display.size.height * display.scaleFactor) } })
    const source = sources.find(s => s.display_id === String(display.id)) || (sources.length === 1 ? sources[0] : undefined)
    if (!source || source.thumbnail.isEmpty()) throw new Error("没有可用的屏幕画面")
    return source.thumbnail.toDataURL()
  } catch (error) {
    if (process.platform !== "darwin" || systemPreferences.getMediaAccessStatus("screen") !== "granted") throw error
    // ScreenCaptureKit can fail even with permission. The native still-image backend
    // captures the selected display rectangle and remains subject to macOS consent.
    const directory = await mkdtemp(join(tmpdir(), "vessel-capture-"))
    try {
      const file = join(directory, "screen.png")
      const { x, y, width, height } = display.bounds
      await promisify(execFile)("/usr/sbin/screencapture", ["-x", "-R", `${x},${y},${width},${height}`, file], { timeout: 10000 })
      const image = nativeImage.createFromPath(file)
      if (image.isEmpty()) throw new Error("系统未返回有效截图")
      return image.toDataURL()
    } finally { await rm(directory, { recursive: true, force: true }) }
  }
}
export async function startScreenshot() {
  if (capturing) return
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.focus()
    return
  }
  capturing = true
  try {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const image = await captureDisplay(display)
    const win = create(display.bounds)
    captureWindow = win
    win.setResizable(false)
    win.webContents.ipc.handle("shot:data", () => ({ mode: "capture", image }))
    let finishing = false
    win.webContents.ipc.handle("shot:finish", async (_event, data: string) => {
      if (typeof data !== "string" || !data.startsWith("data:image/png;base64,") || data.length > 100 * 1024 * 1024) throw new Error("截图数据无效")
      if (finishing) return
      finishing = true
      const img = nativeImage.createFromDataURL(data)
      if (img.isEmpty()) throw new Error("截图为空")
      clipboard.writeImage(img)
      const size = img.getSize()
      const ratio = Math.min(1 / display.scaleFactor, display.workArea.width / size.width, (display.workArea.height - 28) / size.height)
      const pin = create({ x: display.workArea.x + 40, y: display.workArea.y + 40, width: Math.max(180, Math.round(size.width * ratio)), height: Math.max(100, Math.round(size.height * ratio) + 28) })
      pins.add(pin)
      pin.on("closed", () => pins.delete(pin))
      pin.webContents.ipc.handle("shot:data", () => ({ mode: "pin", image: data }))
      pin.webContents.ipc.handle("shot:copy", () => clipboard.writeImage(img))
      await load(pin)
      pin.show()
      if (!win.isDestroyed()) win.close()
    })
    win.on("closed", () => {
      captureWindow = undefined
    })
    await load(win)
    win.show()
    win.focus()
  } catch (error) {
    captureWindow?.close()
    const permission = process.platform === "darwin" ? systemPreferences.getMediaAccessStatus("screen") : undefined
    console.error("[screenshot] Capture failed", { permission, error })
    if (permission && permission !== "granted") {
      const { response } = await dialog.showMessageBox({ type: "warning", title: "需要屏幕录制权限", message: "请允许 Vessel 录制屏幕", detail: "在系统设置 → 隐私与安全性 → 屏幕与系统音频录制中开启权限，然后完全退出并重新打开 Vessel。开发模式可能显示为 Electron 或启动它的终端。", buttons: ["打开系统设置", "取消"], cancelId: 1 })
      if (response === 0) await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
    } else {
      dialog.showErrorBox("截图失败", "无法获取屏幕画面，请确认屏幕未锁定后重试。若刚修改录屏权限，请完全退出并重新打开 Vessel。\n" + (error instanceof Error ? error.message : String(error)))
    }
  } finally {
    capturing = false
  }
}
export function registerScreenshotShortcut() {
  const key = process.platform === "darwin" ? "Control+X" : "F1"
  if (!globalShortcut.register(key, () => void startScreenshot())) dialog.showErrorBox("截图快捷键不可用", `${key} 已被占用，请关闭占用快捷键的程序后重新启动 Vessel。`)
  app.once("will-quit", () => globalShortcut.unregister(key))
}
