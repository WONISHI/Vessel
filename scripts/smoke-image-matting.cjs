// Runs the production renderer's actual IS-Net pipeline with all network blocked.
const { app, BrowserWindow, ipcMain, session } = require("electron")
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict")
app.setPath("userData", fs.mkdtempSync(path.join(require("node:os").tmpdir(), "vessel-matting-")))
app
  .whenReady()
  .then(async () => {
    let remote = 0
    session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, callback) => {
      remote++
      callback({ cancel: true })
    })
    const handlers = { "settings:get": { theme: "light", font: "Plus Jakarta Sans", fontSize: 14, accent: "#16a34a", backup: {} }, "settings:status": { running: false }, "settings:workspace": null, "app-state:get": null, "app-state:set": null, "markdown:pending": [] }
    for (const [name, value] of Object.entries(handlers)) ipcMain.handle(name, () => value)
    const win = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { preload: path.resolve("out/preload/index.js"), sandbox: false } })
    win.webContents.on("console-message", (event) => {
      const message = event.message
      if (/Content Security|Refused|资源|引擎|识别|Failed|wasm/i.test(message)) console.log(message.slice(0, 400))
    })
    const assets = path.resolve("out/renderer/assets"),
      moduleName = fs.readdirSync(assets).find((name) => /^portrait-matting-.*\.js$/.test(name))
    assert(moduleName, "Build the renderer before running this check")
    await win.loadFile(path.resolve("out/renderer/index.html"), { hash: "/image" })
    const controls = await win.webContents.executeJavaScript(`(async () => {
    for (let i = 0; i < 50; i++) {
      const button = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === '更换背景色');
      if (button) { button.click(); break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    const slider = document.querySelector('.image-settings [role="slider"]');
    return { value: slider?.getAttribute('aria-valuenow'), native: !!document.querySelector('.image-toolbox input[type="range"]'), apply: [...document.querySelectorAll('button')].some(button => button.textContent.trim() === '应用背景色'), separate: [...document.querySelectorAll('button')].some(button => button.textContent.trim() === '智能换底') };
  })()`)
    assert.equal(controls.value, "6")
    assert.equal(controls.native, false)
    assert.equal(controls.apply, true)
    assert.equal(controls.separate, false)
    fs.writeFileSync("/private/tmp/vessel-image-background-slider.png", (await win.webContents.capturePage()).toPNG())
    const result = await win.webContents.executeJavaScript(`(async () => {
    const { portraitBackground } = await import('./assets/${moduleName}');
    const input = document.createElement('canvas'); input.width = input.height = 128;
    const ctx = input.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#333333'; ctx.beginPath(); ctx.arc(64, 64, 35, 0, Math.PI * 2); ctx.fill();
    const started = performance.now();
    const output = await portraitBackground(input.toDataURL(), '#438edb', message => console.log(message));
    return { width: output.width, height: output.height, elapsed: performance.now() - started };
  })()`)
    assert.equal(result.width, 128)
    assert.equal(result.height, 128)
    assert.equal(remote, 0, "No HTTP requests may be required")
    console.log("PASS: actual IS-Net inference and compositing completed offline", result)
    win.destroy()
    app.quit()
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
setTimeout(() => {
  console.error("Offline matting smoke test timed out")
  app.exit(1)
}, 180_000).unref()
