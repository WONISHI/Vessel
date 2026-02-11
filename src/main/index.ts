import { app, shell, BrowserWindow, ipcMain } from "electron"
import { join } from "path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import icon from "../../resources/icon.png?asset"
import type { IFeature } from "./type/interfaces/index"

import { OpenDirectoryFeature } from "./features/OpenDirectoryFeature"

function createWindow(): void {
  const features: IFeature[] = [new OpenDirectoryFeature()]

  const start = () => {
    for (const feature of features) {
      try {
        feature.activate()
      } catch (err) {
        console.log(err)
      }
    }
  }

  start()

  const mainWindow = new BrowserWindow({
    width: 1174,
    height: 682,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: true,
    },
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
  })

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
  electronApp.setAppUserModelId("com.electron")
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
