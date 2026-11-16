/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")
const { spawn } = require("node:child_process")
if (!process.argv.includes("--run")) {
  const bundle = path.resolve(process.argv[2] || "dist/mac-arm64/Vessel.app")
  const resources = path.join(bundle, "Contents/Resources")
  if (!fs.existsSync(path.join(resources, "app.asar"))) throw new Error("Missing packaged app.asar")
  const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "vessel-packaged-startup-"))
  const env = { ...process.env, VESSEL_STARTUP_RESOURCES: resources, VESSEL_STARTUP_PROFILE: directory }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(require("electron"), [__filename, "--run"], { env, stdio: "inherit" })
  const timeout = setTimeout(() => { console.error("FAIL: packaged startup timed out"); child.kill("SIGKILL") }, 25000)
  child.on("exit", (code) => { clearTimeout(timeout); process.exitCode = code ?? 1 })
} else {
  const { app, BrowserWindow, dialog } = require("electron")
  const childProcess = require("node:child_process")
  const assert = require("node:assert/strict")
  const resources = process.env.VESSEL_STARTUP_RESOURCES
  const profile = process.env.VESSEL_STARTUP_PROFILE
  app.setPath("userData", profile)
  Object.defineProperty(app, "isPackaged", { value: true })
  Object.defineProperty(process, "resourcesPath", { value: resources })
  app.setAppPath(path.join(resources, "app.asar"))
  // Avoid treating this .cjs runner as a document to preview at startup.
  process.argv = [process.execPath]
  const failures = []
  let native
  let quitting = false
  const originalSpawn = childProcess.spawn
  childProcess.spawn = function (file, ...args) {
    const child = originalSpawn.call(this, file, ...args)
    if (String(file).endsWith("vessel-clipboard")) {
      native = { file, child, started: false }
      child.on("spawn", () => { native.started = true })
      child.on("error", (error) => failures.push(error))
      child.on("exit", () => { if (!quitting) failures.push(new Error("Clipboard native monitor exited during startup")) })
    }
    return child
  }
  const fail = (error) => { failures.push(error); console.error("STARTUP ERROR", error?.stack || String(error)) }
  process.on("uncaughtException", fail)
  process.on("unhandledRejection", fail)
  dialog.showErrorBox = (title, message) => fail(new Error(`${title}: ${message}`))
  app.on("browser-window-created", (_, window) => {
    window.webContents.on("render-process-gone", (_, detail) => fail(new Error(`Renderer exited: ${detail.reason}`)))
    window.webContents.on("did-fail-load", (_, code, description) => fail(new Error(`Load failed ${code}: ${description}`)))
    window.webContents.on("console-message", (event) => { if (event.level === "error") fail(new Error(event.message)) })
  })
  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  app.whenReady().then(async () => {
    try {
      let status
      for (let attempt = 0; attempt < 100; attempt++) {
        const window = BrowserWindow.getAllWindows().find((candidate) => candidate.isVisible() && candidate.webContents.getURL().endsWith("/renderer/index.html"))
        if (window) {
          status = await window.webContents.executeJavaScript("({rootChildren:document.getElementById('root')?.childElementCount||0,textLength:document.body.innerText.trim().length})")
          if (status.rootChildren && status.textLength > 20) {
            await delay(500)
            assert.equal(failures.length, 0, failures.map(String).join("\n"))
            if (process.platform === "darwin") {
              assert(native?.started && native.child.pid, "Native clipboard monitor did not start")
              assert(native.file.includes("app.asar.unpacked"), `Invalid helper path: ${native.file}`)
            }
            assert.equal(app.getPath("userData"), profile, "Smoke check must use an isolated profile")
            fs.writeFileSync(path.join(profile, "startup-preview.png"), (await window.webContents.capturePage()).toPNG())
            console.log("PASS: real packaged main/preload/renderer, visible main window, native clipboard monitor and isolated profile", JSON.stringify(status))
            console.log("Preview:", path.join(profile, "startup-preview.png"))
            return
          }
        }
        if (failures.length) throw failures[0]
        await delay(100)
      }
      throw new Error("The packaged main window did not render")
    } catch (error) { fail(error); process.exitCode = 1 }
    finally { quitting = true; native?.child.kill(); app.quit() }
  })
  try { require(path.join(resources, "app.asar/out/main/index.js")) }
  catch (error) { fail(error); app.exit(1) }
}
