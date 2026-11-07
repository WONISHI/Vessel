import { registerAppUpdate } from "./app-update"
import { drainTextFileWrites } from "@main/modules/files/index.module"
import { registerImageResources } from "@main/modules/files/image-resource"
import { installApplicationMenu } from "@main/menu"
import { registerBases } from "@main/modules/bases"
import { electronApp, is } from "@electron-toolkit/utils"
import { mainApps } from "@main/app/index"
import { secureBrowserGuests } from "@main/browser/browser-security"
import { registerContentSearch } from "@main/files/content-search"
import { registerFileWatch } from "@main/files/file-watch"
import { registerMarkdownOpening } from "@main/files/open-markdown"
import { registerOffice } from "@main/office/office"
import { registerScreenshotShortcut, startScreenshot } from "@main/screenshot/screenshot"
import { registerSettings } from "@main/settings/settings"
import { registerTerminal } from "@main/terminal/terminal"
import { registerTransit } from "@main/transit/transit"
import icon from "@resources/icon.png?asset"
import dockIconPath from "@resources/icon_108x108.png?asset"
import { app, BrowserWindow, ipcMain, nativeImage, nativeTheme, protocol, screen, shell, type Rectangle } from "electron"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "path"

protocol.registerSchemesAsPrivileged([{ scheme: "vessel-image", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])

// Development must not contend with the installed app's lock or databases.
if (!app.isPackaged) {
  const developmentData = join(app.getPath("appData"), `${app.getName()}-dev`)
  mkdirSync(developmentData, { recursive: true })
  app.setPath("userData", developmentData)
}
app.setName("vessel")
registerMarkdownOpening()

let isAppCrashed = false

/** Returns app crashed. */
export function getAppCrashed(): boolean {
  return isAppCrashed
}

/** Sets app crashed. */
export function setAppCrashed(crashed: boolean): void {
  isAppCrashed = crashed
}

let applicationWindow: BrowserWindow | undefined

type WindowState = Rectangle & { maximized?: boolean }
const MIN_WIDTH = 900
const MIN_HEIGHT = 600

/** 读取上次关闭时的窗口位置与大小；不在任何屏幕内时忽略。 */
function loadWindowState(): WindowState | undefined {
  try {
    const state = JSON.parse(readFileSync(join(app.getPath("userData"), "window-state.json"), "utf8")) as WindowState
    if (![state.x, state.y, state.width, state.height].every(Number.isFinite)) return undefined
    const visible = screen.getAllDisplays().some(({ workArea: area }) => state.x < area.x + area.width - 100 && state.x + state.width > area.x + 100 && state.y >= area.y - 20 && state.y < area.y + area.height - 100)
    return visible ? state : undefined
  } catch {
    return undefined
  }
}

/** 首次启动参考 VS Code：按鼠标所在屏幕工作区取接近全屏的尺寸并居中。 */
function defaultWindowBounds(): Rectangle {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  // VS Code 在 1512 宽的屏幕上默认约 1440×(工作区高度)，这里取宽 95%、高铺满工作区
  const width = Math.min(workArea.width, Math.max(MIN_WIDTH, Math.round(workArea.width * 0.95)))
  const height = Math.min(workArea.height, Math.max(MIN_HEIGHT, workArea.height))
  return { x: workArea.x + Math.round((workArea.width - width) / 2), y: workArea.y + Math.round((workArea.height - height) / 2), width, height }
}

/** 关闭前记录窗口状态，下次启动按原样恢复。 */
function trackWindowState(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | undefined
  const save = () => {
    if (window.isDestroyed() || window.isMinimized()) return
    try {
      const bounds = window.isMaximized() || window.isFullScreen() ? window.getNormalBounds() : window.getBounds()
      writeFileSync(join(app.getPath("userData"), "window-state.json"), JSON.stringify({ ...bounds, maximized: window.isMaximized() }))
    } catch {
      // 写入失败不影响退出
    }
  }
  // 窗口调整后防抖保存，避免进程被直接结束时丢失状态
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  window.on("resize", schedule)
  window.on("move", schedule)
  window.on("close", () => {
    clearTimeout(timer)
    save()
  })
}

/** Applies the saved theme before the first paint so the window never flashes the wrong color. */
function initialDark(): boolean {
  try {
    const theme = JSON.parse(readFileSync(join(app.getPath("userData"), "settings.json"), "utf8"))?.theme
    if (theme === "dark" || theme === "light") nativeTheme.themeSource = theme
  } catch {}
  return nativeTheme.shouldUseDarkColors
}

/**
 * Same behavior as @electron-toolkit's optimizer.watchWindowShortcuts, except that in dev F12 does not
 * toggle Vessel's own DevTools while the in-app Browser page is visible (F12 there opens the tab's DevTools).
 */
function watchWindowShortcuts(window: BrowserWindow) {
  const { webContents } = window
  webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return
    if (!is.dev) {
      if (input.code === "KeyR" && (input.control || input.meta)) event.preventDefault()
      if (input.code === "KeyI" && ((input.alt && input.meta) || (input.control && input.shift))) event.preventDefault()
    } else if (input.code === "F12" && !input.isAutoRepeat) {
      void webContents
        .executeJavaScript(`!!document.querySelector("[data-vessel-browser-page]:not([hidden])")`)
        .catch(() => false)
        .then((browserVisible) => {
          if (browserVisible || webContents.isDestroyed()) return
          if (webContents.isDevToolsOpened()) webContents.closeDevTools()
          else webContents.openDevTools({ mode: "undocked" })
        })
    }
    if (input.code === "Minus" && (input.control || input.meta)) event.preventDefault()
    if (input.code === "Equal" && input.shift && (input.control || input.meta)) event.preventDefault()
  })
}

/** Creates window. */
function createWindow(): void {
  const dark = initialDark()
  const savedState = loadWindowState()
  const bounds = savedState ?? defaultWindowBounds()
  const mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: dark ? "#22272E" : "#FFFFFF",
    autoHideMenuBar: true,
    icon: icon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      webviewTag: true,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: true
    }
  })
  trackWindowState(mainWindow)
  // Start loading immediately; every handler below is registered synchronously before any renderer IPC can arrive.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    void mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }

  mainWindow.webContents.ipc.handle("app:appearance", (_event, dark: boolean) => {
    if (typeof dark !== "boolean") return
    nativeTheme.themeSource = dark ? "dark" : "light"
    mainWindow.setBackgroundColor(dark ? "#22272E" : "#FFFFFF")
  })

  applicationWindow = mainWindow
  mainWindow.on("closed", () => {
    if (applicationWindow === mainWindow) applicationWindow = undefined
  })

  mainWindow.webContents.on("render-process-gone", () => {
    isAppCrashed = true
  })

  ipcMain.removeHandler("app:confirm-quit")
  ipcMain.handle("app:confirm-quit", () => {
    app.quit()
  })

  ipcMain.removeHandler("app:report-crash")
  ipcMain.handle("app:report-crash", (_event, crashed: boolean) => {
    isAppCrashed = Boolean(crashed)
  })

  ipcMain.removeHandler("app:relaunch")
  ipcMain.handle("app:relaunch", () => {
    app.relaunch()
    app.exit(0)
  })

  ipcMain.removeHandler("app:reload")
  ipcMain.handle("app:reload", () => {
    isAppCrashed = false
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload()
    }
  })

  if (process.platform === "win32") {
    mainWindow.setOverlayIcon(null, "")
    mainWindow.on("focus", () => mainWindow.setOverlayIcon(null, ""))
  }
  secureBrowserGuests(mainWindow.webContents)
  mainWindow.webContents.ipc.handle("tools:translate", async (_event, text, from, to) => {
    const { translateText } = await import("@main/translate")
    return translateText(text, from, to)
  })
  registerSettings(mainWindow.webContents)
  registerAppUpdate(mainWindow.webContents)
  registerOffice(mainWindow.webContents)
  registerTransit(mainWindow.webContents)
  registerContentSearch(mainWindow.webContents)
  registerTerminal(mainWindow.webContents)
  registerFileWatch(mainWindow.webContents)
  registerBases(mainWindow.webContents)

  // maximize() shows a hidden window on macOS, so defer it until ready-to-show — show ASAP for welcome.
  let shown = false
  const reveal = () => {
    if (shown || mainWindow.isDestroyed()) return
    shown = true
    clearTimeout(fallback)
    if (savedState?.maximized) mainWindow.maximize()
    mainWindow.show()
  }
  const fallback = setTimeout(reveal, 3000)
  mainWindow.once("ready-to-show", reveal)

  ipcMain.removeHandler("open-devtools")
  ipcMain.removeHandler("preview-screenshot")
  ipcMain.handle("preview-screenshot", (event) => startScreenshot(event.sender))
  ipcMain.handle("open-devtools", (event) => {
    const contents = event.sender
    if (contents.isDevToolsOpened()) {
      contents.closeDevTools()
    } else {
      contents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })
}

app.whenReady().then(() => {
  registerImageResources()
  electronApp.setAppUserModelId("com.wonishi.vessel")

  mainApps.activate()

  if (process.platform === "darwin") {
    const original = nativeImage.createFromPath(dockIconPath)
    if (!original.isEmpty()) {
      // Dock 按画布缩放图标；透明边距使可见图形与其他应用的尺寸一致。
      const size = 256
      const inset = 24
      const contentSize = size - inset * 2
      const bitmap = original.resize({ width: contentSize, height: contentSize }).toBitmap()
      const canvas = Buffer.alloc(size * size * 4)
      for (let row = 0; row < contentSize; row++) {
        bitmap.copy(canvas, ((row + inset) * size + inset) * 4, row * contentSize * 4, (row + 1) * contentSize * 4)
      }
      app.dock?.setIcon(nativeImage.createFromBitmap(canvas, { width: size, height: size }))
    }
  }

  app.on("browser-window-created", (_, window) => {
    watchWindowShortcuts(window)
  })

  ipcMain.on("ping", () => console.log("pong"))

  createWindow()
  installApplicationMenu(() => {
    if (!applicationWindow || applicationWindow.isDestroyed()) createWindow()
    return applicationWindow
  })
  registerScreenshotShortcut()

  app.on("activate", function () {
    if (!applicationWindow || applicationWindow.isDestroyed()) createWindow()
    else {
      if (applicationWindow.isMinimized()) applicationWindow.restore()
      applicationWindow.show()
      applicationWindow.focus()
    }
  })
})

app.on("window-all-closed", () => {
  app.quit()
})

let drainingTextWrites = false
app.on("before-quit", (event) => {
  if (drainingTextWrites) {
    event.preventDefault()
    return
  }
  const pending = drainTextFileWrites()
  if (pending) {
    event.preventDefault()
    drainingTextWrites = true
    void pending.then(() => {
      drainingTextWrites = false
      app.quit()
    })
    return
  }
  mainApps.dispose()
})

app.on("will-quit", () => {
  mainApps.dispose()
})
