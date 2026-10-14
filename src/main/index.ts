import { registerScreenshotShortcut } from "./screenshot"
import { registerContentSearch } from './content-search'
import { registerSettings } from "./settings"
import { registerTransit } from "./transit"
import { registerOffice } from "./office"
import { registerFileWatch } from "./file-watch"
import { registerTerminal } from "./terminal"
import { secureBrowserGuests } from "./browser-security"
import { registerMarkdownOpening } from "./open-markdown"
import { join } from "path"
import { mkdirSync } from "node:fs"
import { app, shell, BrowserWindow, ipcMain, nativeImage } from "electron"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import dockIconPath from "../../resources/icon_108x108.png?asset"
import icon from "../../resources/icon.png?asset"
import { mainApps } from "@main/app"

// Development must not contend with the installed app's lock or databases.
if (!app.isPackaged) {
  const developmentData = join(app.getPath("appData"), `${app.getName()}-dev`)
  mkdirSync(developmentData, { recursive: true })
  app.setPath("userData", developmentData)
}
registerMarkdownOpening()

let isAppCrashed = false
export function getAppCrashed(): boolean { return isAppCrashed }
export function setAppCrashed(crashed: boolean): void { isAppCrashed = crashed }

let applicationWindow: BrowserWindow | undefined
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1174,
    height: 682,
    show: false,
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

  applicationWindow = mainWindow
  mainWindow.on("closed", () => { if (applicationWindow === mainWindow) applicationWindow = undefined })

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
  registerSettings(mainWindow.webContents)
  registerOffice(mainWindow.webContents)
  registerTransit(mainWindow.webContents)
  registerContentSearch(mainWindow.webContents)
  registerTerminal(mainWindow.webContents)
  registerFileWatch(mainWindow.webContents)

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
  })

  ipcMain.removeHandler("open-devtools")
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

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.your.app")

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
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on("ping", () => console.log("pong"))

  createWindow()
  registerScreenshotShortcut()

  app.on("activate", function () {
    if (!applicationWindow || applicationWindow.isDestroyed()) createWindow()
    else { if (applicationWindow.isMinimized()) applicationWindow.restore(); applicationWindow.show(); applicationWindow.focus() }
  })
})

app.on("window-all-closed", () => {
  app.quit()
})

app.on("before-quit", () => {
  mainApps.dispose()
})
