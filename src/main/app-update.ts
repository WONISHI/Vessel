import { app, type WebContents } from "electron"
import updater from "electron-updater"
import type { AppUpdateState } from "../shared/app-update"
import { drainTextFileWrites } from "@main/modules/files/index.module"

const { autoUpdater } = updater
const supported = app.isPackaged && process.platform === "win32"
let state: AppUpdateState = { status: supported ? "idle" : "unsupported" }
let windowContents: WebContents | undefined
let initialized = false

function update(next: AppUpdateState) {
  state = next
  if (windowContents && !windowContents.isDestroyed()) windowContents.send("app-update:state", next)
}

function reportError(error: unknown) {
  console.error("Application update failed:", error)
  update({ status: "error", message: "更新失败，请检查网络连接后重试。" })
}

async function check() {
  if (!supported || !["idle", "current", "error", "available"].includes(state.status)) return
  update({ status: "checking" })
  try {
    const result = await autoUpdater.checkForUpdates()
    if (state.status === "checking") {
      update(result?.isUpdateAvailable
        ? { status: "available", version: result.updateInfo.version }
        : { status: "current" })
    }
  } catch (error) {
    reportError(error)
  }
}

export function registerAppUpdate(contents: WebContents) {
  windowContents = contents
  contents.ipc.handle("app-update:get", () => state)
  contents.ipc.handle("app-update:check", check)
  contents.ipc.handle("app-update:download", async () => {
    if (state.status !== "available") return
    update({ status: "downloading", version: state.version, percent: 0 })
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      reportError(error)
    }
  })
  contents.ipc.handle("app-update:install", async () => {
    if (state.status !== "ready") return
    update({ status: "installing", version: state.version })
    try {
      await drainTextFileWrites()
      autoUpdater.quitAndInstall(false, true)
    } catch (error) {
      reportError(error)
    }
  })

  if (!supported || initialized) return
  initialized = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.on("error", (error) => {
    if (state.status === "installing") reportError(error)
  })
  autoUpdater.on("download-progress", ({ percent }) => {
    if (state.status === "downloading") update({ ...state, percent })
  })
  autoUpdater.on("update-downloaded", ({ version }) => update({ status: "ready", version }))
  contents.once("did-finish-load", () => { void check() })
}
