const { app, BrowserWindow, ipcMain, webContents } = require("electron")
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict")
app.setPath("userData", fs.mkdtempSync(path.join(require("node:os").tmpdir(), "vessel-menu-")))
app
  .whenReady()
  .then(async () => {
    const handlers = {
      "browser:proxy:status": { connected: false, busy: false, stage: "未连接", nodes: ["HK - 香港综合", "JP - 日本"], selected: "HK - 香港综合", hasSubscription: true },
      "browser:proxy:subscription": "",
      "settings:status": { running: false },
      "settings:get": { theme: "light", font: "Plus Jakarta Sans", fontSize: 14, accent: "#16a34a" },
      "image:clipboard": require("electron")
        .nativeImage.createFromBitmap(Buffer.alloc(2000 * 1000 * 4, 255), { width: 2000, height: 1000 })
        .toDataURL(),
      "browser:bookmarks:sync": null,
      "browser:extensions:list": [],
      "browser:extensions:close": null,
      "browser:devtools": null,
      "browser:devices": [],
      "browser:emulate": null,
      "browser:history:list": [{ id: 1, title: "Test history " + "Long title ".repeat(30), url: "https://example.com", visitedAt: Date.now() }],
      "markdown:pending": [],
      "workspace:readDirectory": [],
      "app-state:get": null,
      "app-state:set": null,
      "files:watch": "test",
      "files:unwatch": null
    }
    for (const [name, value] of Object.entries(handlers)) ipcMain.handle(name, () => value)
    const win = new BrowserWindow({ show: true, width: 1200, height: 800, webPreferences: { preload: path.resolve("out/preload/index.js"), sandbox: false, webviewTag: true } })
    await win.loadFile(path.resolve("out/renderer/index.html"), { hash: "/browser" })

    /** Performs the js operation. */
    const js = (code) =>
      win.webContents.executeJavaScript(code).catch((error) => {
        console.error("Failed expression:", code)
        throw error
      })
    await new Promise((resolve) => setTimeout(resolve, 1000))

    /** Performs the click operation. */
    const click = async (selector) => {
      const point = await js(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)} })()`)
      win.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, ...point })
      win.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, ...point })
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    const server = require("node:http").createServer((req, res) => {
      res.setHeader("content-type", "text/html")
      if (req.url === "/login") res.setHeader("Set-Cookie", "session_fixture=logged_in; Path=/; HttpOnly")
      res.end("<html><title>Session fixture</title><body>" + String(req.headers.cookie || "") + "</body></html>")
    })
    await new Promise((r) => server.listen(0, "127.0.0.1", r))
    const base = "http://127.0.0.1:" + server.address().port
    ipcMain.handle("transit:clipboard", () => base + "/preview")
    await js(`document.querySelector('.browser-address input').focus()`)
    await win.webContents.insertText(base + "/login")
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Enter" })
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" })
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100))
      if (await js(`document.querySelector('webview')?.getURL().includes('/login')`)) break
    }
    await new Promise((r) => setTimeout(r, 500))
    const browserId = await js(`document.querySelector('webview').getWebContentsId()`)
    await js(`document.querySelector('button[aria-label^="中转站，"]').click()`)
    await new Promise((r) => setTimeout(r, 100))
    await js(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='读取剪贴板').click()`)
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100))
      if (await js(`document.querySelectorAll('webview').length===2`)) break
    }
    await new Promise((r) => setTimeout(r, 1000))
    const previewId = await js(`Array.from(document.querySelectorAll('webview')).find(v=>v.getURL().includes('/preview')).getWebContentsId()`)
    assert.equal(webContents.fromId(browserId).session, webContents.fromId(previewId).session, "Transit and browser share persistent session")
    assert((await webContents.fromId(previewId).executeJavaScript("document.body.textContent")).includes("session_fixture=logged_in"), "Transit request includes existing HttpOnly browser cookie")
    server.close()
    console.log("PASS browser login cookie shared with actual transit preview webview")
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
setTimeout(() => app.exit(1), 30000).unref()
