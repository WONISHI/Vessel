/* eslint-disable @typescript-eslint/no-require-imports -- Electron main-process smoke runner uses CommonJS. */
// Run with Electron (without ELECTRON_RUN_AS_NODE); uses a temporary profile and local fixture.
const { app, BrowserWindow, WebContentsView, nativeImage } = require("electron")
const fs = require("node:fs")
const path = require("node:path")
const os = require("node:os")
const { pathToFileURL } = require("node:url")
const assert = require("node:assert/strict")
const ts = require("typescript")
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vessel-node-shot-"))
app.setPath("userData", profile)
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
}
const { enableBrowserNodeScreenshots } = require("../src/main/browser/browser-devtools-screenshot.ts")
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const timeout = setTimeout(() => { console.error("Timed out"); app.exit(1) }, 30000)
app.whenReady().then(async () => {
  const fixture = path.join(profile, "fixture.html")
  fs.writeFileSync(fixture, '<!doctype html><style>body{margin:0}#target{width:200px;height:120px;background:rgb(23,177,96)}#below{position:absolute;top:1400px;left:20px;width:240px;height:180px;background:rgb(40,90,190)}#empty{display:none}#clipped{position:absolute;left:280px;top:30px;width:240px;height:130px;overflow:hidden;background:white}#scroller{height:100px;overflow:auto}.long{height:620px;background:linear-gradient(rgb(20,100,210),rgb(30,180,100))}#cover{position:fixed;left:285px;top:35px;width:220px;height:60px;background:rgb(255,0,0);z-index:9999}</style><main id="target">Node screenshot</main><div id="below">Below viewport</div><div id="empty"></div><section id="clipped"><div id="scroller"><div class="long">Full scroll content</div></div></section><div id="cover">Unrelated overlay</div>')
  const host = new BrowserWindow({ width: 1100, height: 700, show: false, webPreferences: { webviewTag: true } })
  const panel = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  host.contentView.addChildView(panel)
  panel.setBounds({ x: 650, y: 0, width: 450, height: 700 })
  const attached = new Promise(resolve => host.webContents.once("did-attach-webview", (_event, guest) => resolve(guest)))
  await host.loadURL("data:text/html," + encodeURIComponent(`<webview style="width:640px;height:650px" src="${pathToFileURL(fixture)}"></webview>`))
  const guest = await attached
  if (guest.isLoading()) await new Promise(resolve => guest.once("did-stop-loading", resolve))
  const ready = new Promise(resolve => guest.once("devtools-opened", resolve))
  guest.setDevToolsWebContents(panel.webContents)
  guest.openDevTools({ mode: "detach", activate: false })
  host.showInactive()
  await ready
  await enableBrowserNodeScreenshots(panel.webContents)
  await enableBrowserNodeScreenshots(panel.webContents) // Repeated setup must not wrap the handler twice.
  await panel.webContents.executeJavaScript(`(async () => {
    const Host = await import('./core/host/host.js');
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.save = (name, data, saveAs, base64) => { globalThis.__vesselSavedShot = { name, data, saveAs, base64 }; };
  })()`)
  const capture = async (selector) => {
    await panel.webContents.executeJavaScript(`(async () => {
      globalThis.__vesselSavedShot = null;
      document.querySelectorAll('[role="alert"]').forEach(node => node.remove());
      const SDK = await import('./core/sdk/sdk.js');
      const UI = await import('./ui/legacy/legacy.js');
      const Emulation = await import('./panels/emulation/emulation.js');
      let model;
      for (let attempt = 0; attempt < 50; attempt++) {
        model = SDK.TargetManager.TargetManager.instance().models(SDK.DOMModel.DOMModel)[0];
        if (model) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const documentNode = await model.requestDocument();
      const node = model.nodeForId(await model.querySelector(documentNode.id, ${JSON.stringify(selector)}));
      UI.Context.Context.instance().setFlavor(SDK.DOMModel.DOMNode, node);
      new Emulation.DeviceModeWrapper.ActionDelegate().handleAction(UI.Context.Context.instance(), 'emulation.capture-node-screenshot');
    })()`)
    for (let attempt = 0; attempt < 60; attempt++) {
      const result = await panel.webContents.executeJavaScript("({saved:globalThis.__vesselSavedShot,error:document.querySelector('[role=alert]')?.textContent})")
      if (result.saved || result.error) return result
      await delay(50)
    }
    throw new Error("Node screenshot did not finish")
  }
  for (const zoom of [1, 0.6]) {
    guest.setZoomFactor(zoom)
    for (const [selector, width, height] of [["#target", 200, 120], ["#below", 240, 180], ["#clipped", 240, 620]]) {
      await guest.executeJavaScript("document.querySelector('#scroller').scrollTop=200")
      const before = await guest.executeJavaScript("JSON.stringify([...document.querySelectorAll('*')].map(node=>[node.tagName,node.getAttribute('style'),node.scrollTop,node.scrollLeft]))")
      const result = await capture(selector)
      const after = await guest.executeJavaScript("JSON.stringify([...document.querySelectorAll('*')].map(node=>[node.tagName,node.getAttribute('style'),node.scrollTop,node.scrollLeft]))")
      assert.equal(after, before, "restores styles and scroll positions before saving")
      assert.equal(result.error, undefined)
      const { name, data, saveAs, base64 } = result.saved
      assert.equal(name, "node-screenshot.png")
      assert.equal(saveAs, true)
      assert.equal(base64, true)
      const buffer = Buffer.from(data, "base64")
      const image = nativeImage.createFromBuffer(buffer)
      const size = image.getSize()
      assert(!image.isEmpty())
      if (selector === "#clipped") {
        const bitmap = image.toBitmap()
        const offset = (Math.floor(size.height * 0.1) * size.width + Math.floor(size.width * 0.5)) * 4
        assert(bitmap[offset + 2] < 100, "unrelated red overlay is excluded")
      }
      assert(Math.abs(size.width / size.height - width / height) < 0.03, `${selector}: actual ${size.width}x${size.height}, expected ratio ${width}:${height}`)
      const output = path.join(profile, `${selector.slice(1)}-${zoom}.png`)
      fs.writeFileSync(output, buffer)
      console.log(`PASS: ${selector}, zoom=${zoom}, ${size.width}x${size.height}, PNG + native save request: ${output}`)
    }
  }
  const original = await guest.executeJavaScript("JSON.stringify([...document.querySelectorAll('*')].map(node=>[node.tagName,node.getAttribute('style'),node.scrollTop,node.scrollLeft]))")
  await panel.webContents.executeJavaScript(`(async()=>{
    const SDK=await import('./core/sdk/sdk.js');
    const prototype=SDK.ScreenCaptureModel.ScreenCaptureModel.prototype;
    globalThis.__vesselCaptureOriginal=prototype.captureScreenshot;
    prototype.captureScreenshot=async()=>{throw new Error('Simulated capture failure')};
  })()`)
  const failed = await capture("#clipped")
  assert(failed.error.includes("Simulated capture failure"))
  assert.equal(await guest.executeJavaScript("JSON.stringify([...document.querySelectorAll('*')].map(node=>[node.tagName,node.getAttribute('style'),node.scrollTop,node.scrollLeft]))"), original)
  await panel.webContents.executeJavaScript(`(async()=>{const SDK=await import('./core/sdk/sdk.js');SDK.ScreenCaptureModel.ScreenCaptureModel.prototype.captureScreenshot=globalThis.__vesselCaptureOriginal})()`)
  console.log("PASS: restores the page even when screenshot capture fails")
  const empty = await capture("#empty")
  assert.equal(empty.saved, null)
  assert(empty.error.includes("没有可截图的显示区域"))
  console.log("PASS: invisible element produces a visible error")
  host.destroy()
  clearTimeout(timeout)
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
