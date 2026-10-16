const { app, BrowserWindow, ipcMain } = require("electron")
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
    assert.equal(await js(`document.querySelector('footer[aria-label="底部状态栏"]').getBoundingClientRect().height`), 32)
    assert(await js(`document.querySelector('footer time').textContent.includes('年')`), "Shared clock renders")
    assert(await js(`document.querySelector('footer').textContent.includes('未连接')`), "Proxy state renders")
    await js(`Array.from(document.querySelectorAll('footer button')).find(e=>e.textContent==='搜索').click()`)
    await new Promise((r) => setTimeout(r, 250))
    assert(await js(`document.activeElement.getAttribute('aria-label')==='在网页中查找'`), "Status search focuses find input")
    assert(await js(`document.querySelector('.browser-find').getBoundingClientRect().bottom<document.querySelector('footer').getBoundingClientRect().top`), "Find panel above status bar")
    await js(`document.querySelector('[aria-label="关闭查找"]').click();window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',metaKey:true,bubbles:true}))`)
    await new Promise((r) => setTimeout(r, 250))
    fs.writeFileSync("/tmp/vessel-command-new.png", (await win.webContents.capturePage()).toPNG())
    await js(`Array.from(document.querySelectorAll('[cmdk-item]')).find(e=>e.textContent==='关闭控制按钮').click()`)
    await new Promise((r) => setTimeout(r, 500))
    fs.writeFileSync("/tmp/vessel-browser-status.png", (await win.webContents.capturePage()).toPNG())
    await js(`location.hash='/settings'`)
    await new Promise((r) => setTimeout(r, 1000))
    await js(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='快捷键').click()`)
    await new Promise((r) => setTimeout(r, 200))
    assert(await js(`document.body.textContent.includes('命令菜单') && document.body.textContent.includes('F12') && document.body.textContent.includes('截图钉到桌面')`), "Settings reads shortcut registry")
    console.log("PASS shared browser status, find anchor/focus, command appearance and shortcut settings")
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
setTimeout(() => app.exit(1), 30000).unref()
