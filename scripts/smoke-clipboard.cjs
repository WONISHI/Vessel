/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")
const { execFileSync, spawn } = require("node:child_process")
const directory = process.env.VESSEL_CLIPBOARD_SMOKE || fs.mkdtempSync(path.join(require("node:os").tmpdir(), "vessel-clipboard-smoke-"))

if (!process.argv.includes("--run")) {
  const backupHelper = path.join(directory, "backup")
  const backup = path.join(directory, "pasteboard.plist")
  execFileSync("/usr/bin/xcrun", ["clang", "-fobjc-arc", "scripts/testing/clipboard-backup.m", "-framework", "AppKit", "-o", backupHelper])
  execFileSync(backupHelper, ["backup", backup])
  const env = { ...process.env, VESSEL_CLIPBOARD_SMOKE: directory }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(require("electron"), [__filename, "--run"], { env, stdio: "inherit" })
  const timer = setTimeout(() => { console.error("FAIL: clipboard smoke timed out"); child.kill("SIGKILL") }, 45000)
  child.on("exit", (code) => {
    clearTimeout(timer)
    try { execFileSync(backupHelper, ["restore", backup]); fs.unlinkSync(backup) } catch (error) { console.error("Could not restore original pasteboard", error); process.exitCode = 1 }
    process.exitCode ||= code ?? 1
  })
} else {
  const { app, BrowserWindow, clipboard, globalShortcut, nativeImage } = require("electron")
  const assert = require("node:assert/strict")
  const ts = require("typescript")
  app.setPath("userData", directory)
  require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
  let service
  const delay = (time) => new Promise((resolve) => setTimeout(resolve, time))
  const wait = async (predicate, message) => {
    for (let index = 0; index < 50; index++) { if (await predicate()) return; await delay(80) }
    throw new Error(message)
  }
  app.whenReady().then(async () => {
    const { startClipboardHistory } = require(path.resolve("src/main/clipboard/service.ts"))
    service = startClipboardHistory({ directory, helperPath: path.resolve("out/main/vessel-clipboard"), preloadPath: path.resolve("out/preload/clipboard.js"), loadPanel: (window) => window.loadFile(path.resolve("out/renderer/clipboard.html")) })
    await service.show()
    const panel = BrowserWindow.getAllWindows()[0]
    panel.webContents.on("console-message", (event) => { if (event.level === "error") console.error("panel:", event.message) })
    await delay(350)
    await panel.webContents.executeJavaScript("window.clipboardAPI.clear()")
    for (const text of [":deep(.el-tabs__nav-wrap) {\n  width: fit-content;\n}", "https://element-plus.org/zh-CN/component/icon", "#8DB9F8", "让每一次复制，\n都有迹可循。\n\nVessel Clipboard"]) {
      clipboard.writeText(text)
      await wait(() => service.state().entries.some((entry) => entry.preview === text), "native monitor did not capture text")
    }
    const pixels = Buffer.alloc(256 * 150 * 4)
    for (let y = 0; y < 150; y++) for (let x = 0; x < 256; x++) { const i = (y * 256 + x) * 4; pixels[i] = 180 + Math.floor(y / 3); pixels[i + 1] = 130 + Math.floor(x / 3); pixels[i + 2] = 70 + Math.floor(y / 2); pixels[i + 3] = 255 }
    clipboard.writeImage(nativeImage.createFromBitmap(pixels, { width: 256, height: 150 }))
    await wait(() => service.state().entries.some((entry) => entry.kind === "image"), "image was not captured")
    const files = [path.join(directory, "设计说明.md"), path.join(directory, "clipboard.ts")]
    files.forEach((file) => fs.writeFileSync(file, "clipboard fixture"))
    execFileSync(path.resolve("out/main/vessel-clipboard"), ["--write-files", ...files])
    assert.equal(JSON.parse(execFileSync(path.resolve("out/main/vessel-clipboard"), ["--read-files"], { encoding: "utf8" })).length, 2, "native writer must retain every file")
    try { await wait(() => service.state().entries.some((entry) => entry.kind === "files" && entry.files.length === 2), "Finder file references were not captured") }
    catch (error) { console.error("Formats:", clipboard.availableFormats(), "Entry types:", service.state().entries.map((entry) => [entry.kind, entry.files.length])); throw error }
    if (!panel.isVisible()) await service.show()
    try { await wait(async () => await panel.webContents.executeJavaScript('document.querySelectorAll(".clip-card").length') >= 6, "renderer did not refresh") }
    catch (error) { console.error("Renderer status:", await panel.webContents.executeJavaScript('JSON.stringify({cards:document.querySelectorAll(".clip-card").length,status:document.querySelector(".clipboard-status")?.textContent,empty:document.querySelector(".clipboard-empty strong")?.textContent})'), "visible:", panel.isVisible(), "history count:", service.state().total); throw error }
    await panel.webContents.executeJavaScript('document.querySelector(".clipboard-search input").blur()')
    await delay(200)
    const screenshot = path.join(directory, "clipboard-preview.png")
    fs.writeFileSync(screenshot, (await panel.webContents.capturePage()).toPNG())
    console.log("Preview:", screenshot)
    const entries = service.state().entries
    const image = entries.find((entry) => entry.kind === "image")
    await service.copy(image.id)
    assert.deepEqual(clipboard.readImage().getSize(), { width: 256, height: 150 })
    assert.equal(panel.isVisible(), false)
    await service.show()
    const fileEntry = entries.find((entry) => entry.kind === "files")
    await service.copy(fileEntry.id)
    assert.deepEqual(JSON.parse(execFileSync(path.resolve("out/main/vessel-clipboard"), ["--read-files"], { encoding: "utf8" })), files)
    clipboard.write({ text: "rich text fixture", html: "<b>rich text fixture</b>" })
    await wait(() => service.state().entries.some((entry) => entry.preview === "rich text fixture"), "rich text was not captured")
    const rich = service.state().entries.find((entry) => entry.preview === "rich text fixture")
    await service.copy(rich.id)
    assert(clipboard.readHTML().includes("<b>rich text fixture</b>"))
    await service.show()
    await panel.webContents.executeJavaScript("window.clipboardAPI.pause(true)")
    const count = service.state().total
    clipboard.writeText("must not be recorded while paused")
    await delay(400)
    assert.equal(service.state().total, count)
    execFileSync(path.resolve("out/main/vessel-clipboard"), ["--write-files", ...files])
    await delay(300)
    await panel.webContents.executeJavaScript("window.clipboardAPI.pause(false)")
    await delay(400)
    assert.equal(service.state().entries.filter((entry) => entry.kind === "files").length, 1)
    assert(service.state().entries.filter((entry) => entry.kind === "files").every((entry) => entry.files.length === 2))
    assert.equal(globalShortcut.isRegistered("Command+V"), false)
    console.log("PASS: native changes, text/link/color/image/multiple files, rich text restore, pause, production renderer + isolated preload, copy/close; global shortcut:", service.state().shortcutRegistered)
    service.dispose()
    app.quit()
  }).catch((error) => { console.error(error); service?.dispose(); app.exit(1) })
}
