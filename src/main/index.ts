import { registerFileWatch } from "./file-watch"
import { registerTerminal } from "./terminal"
import { secureBrowserGuests } from "./browser-security"
import { registerMarkdownOpening } from "./open-markdown"
import { join } from "path"
import { app, shell, BrowserWindow, ipcMain, nativeImage } from "electron"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import dockIconPath from "../../resources/icon_108x108.png?asset"
import icon from "../../resources/icon.png?asset"
import { mainApps } from "@main/app"

const primaryInstance = app.requestSingleInstanceLock()
if (!primaryInstance) app.quit()
else registerMarkdownOpening()

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

  if (process.platform === "win32") {
    mainWindow.setOverlayIcon(null, "")
    mainWindow.on("focus", () => mainWindow.setOverlayIcon(null, ""))
  }
  secureBrowserGuests(mainWindow.webContents)
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
  if (!primaryInstance) return
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

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", () => {
  mainApps.dispose()
})
