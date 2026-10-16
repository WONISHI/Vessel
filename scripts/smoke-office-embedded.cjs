const { app, BrowserWindow, ipcMain } = require("electron")
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  Module = require("node:module"),
  ts = require("typescript"),
  assert = require("node:assert/strict")
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vessel-embedded-"))
app.setPath("userData", profile)
app.setAppPath(process.cwd())

/** Performs the wait operation. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
app
  .whenReady()
  .then(async () => {
    const target = path.join(profile, "embedded.pptx")
    fs.copyFileSync("/tmp/vessel-office-export.pptx", target)
    const file = { name: "embedded.pptx", path: target }
    for (const [name, value] of Object.entries({ "settings:get": { theme: "light" }, "markdown:pending": [], "workspace:readDirectory": [file], "app-state:set": null, "files:watch": "test", "files:unwatch": null, "browser:extensions:list": [], "settings:status": { running: false } }))
      ipcMain.handle(name, () => value)
    ipcMain.handle("app-state:get", (_e, key) => (key.startsWith("workspace-tabs:") ? { files: [file], active: target } : null))
    const win = new BrowserWindow({ show: false, width: 1400, height: 900, webPreferences: { preload: path.resolve("out/preload/index.js"), sandbox: false, webviewTag: true } })
    const mod = new Module(path.resolve("out/main/embedded-test.cjs"), module)
    mod.filename = path.resolve("out/main/embedded-test.cjs")
    mod.paths = module.paths
    mod._compile(ts.transpile(fs.readFileSync("src/main/office/office.ts", "utf8"), { module: 1, target: 9 }), mod.filename)
    mod.exports.registerOffice(win.webContents)
    await win.loadFile(path.resolve("out/renderer/index.html"), { hash: "/image" })

    /** Performs the js operation. */
    const js = (code) => win.webContents.executeJavaScript(code)
    await js(`localStorage.setItem('app_current_workspace',${JSON.stringify(JSON.stringify({ name: "Office fixture", path: profile, files: [file] }))});location.hash='/editor'`)
    let editor
    for (let i = 0; i < 90; i++) {
      await wait(500)
      editor = win.webContents.mainFrame.framesInSubtree.find((f) => f.url.includes("office.html?editor=1&embedded=1"))
      if (editor && (await editor.executeJavaScript(`!!document.querySelector('iframe')?.contentWindow?.Asc?.editor?.asc_DownloadAs && document.querySelector('iframe')?.contentDocument?.querySelectorAll('canvas').length>0`))) break
    }
    assert(editor, "Office file opens embedded editor")
    assert(await editor.executeJavaScript(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('canvas').length>0`), "Office canvas rendered")
    assert.equal(await js("location.hash"), "#/editor/file", "Stays inside project document tab")
    await wait(10000)
    await js(`window.addEventListener('message',e=>console.log('MESSAGE',e.data?.type,e.data?.status))`)
    win.webContents.on("console-message", (_e, _l, m) => console.log(m))
    const before = fs.statSync(target).mtimeMs
    await js(`document.querySelector('iframe[title^="ONLYOFFICE "]').contentWindow.postMessage({type:'office:export',format:'PPTX'},'*')`)
    for (let i = 0; i < 60 && fs.statSync(target).mtimeMs === before; i++) await wait(500)
    assert(fs.statSync(target).mtimeMs > before, "Save commits to original file")
    assert.equal(fs.readFileSync(target).subarray(0, 2).toString(), "PK")
    console.log("PASS Office project tab embeds renderer and saves to original file")
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
setTimeout(() => app.exit(1), 90000).unref()
