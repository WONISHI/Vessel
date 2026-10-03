const { app, BrowserWindow, session } = require('electron')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), assert = require('node:assert/strict')
const profile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'vessel-tools-'))
app.setPath('userData', profile)
require.extensions['.ts'] = (module, filename) => {
  let source = fs.readFileSync(filename, 'utf8')
  if (filename.endsWith('browser-devtools.ts')) source = source.replace(/import jakartaPath from .*\n/, `const jakartaPath = ${JSON.stringify(path.resolve('node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2'))}\n`)
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
}
let server
app.whenReady().then(async () => {
  server = require('node:http').createServer((_req, res) => res.end('<html><head><title>History fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>device test</body></html>'))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const host = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { webviewTag: true } })
  const handlers = {}
  host.webContents.ipc.handle = (name, handler) => { handlers[name] = handler }
  require('../src/main/browser-tools.ts').registerBrowserTools(host.webContents)
  require('../src/main/browser-devtools.ts').registerBrowserDevtools(host.webContents)
  const independentDevices = await handlers['browser:devices']()
  assert(independentDevices.length > 10, 'reads devices without opening console')
  console.log('PASS: device catalog available with console closed')
  const attached = new Promise(resolve => host.webContents.once('did-attach-webview', (_event, guest) => resolve(guest)))
  await host.loadURL('data:text/html,' + encodeURIComponent(`<webview partition="persist:vessel-browser" src="http://127.0.0.1:${server.address().port}" style="width:1000px;height:600px"></webview>`))
  const guest = await attached
  if (guest.isLoading()) await new Promise(resolve => guest.once('did-stop-loading', resolve))
  assert.equal(handlers['browser:history:list']().length, 1)
  handlers['browser:devtools']({}, guest.id, { x: 0, y: 600, width: 1000, height: 250 }, { font: 'Menlo', size: 13 })
  let devices
  for (let attempt = 0; attempt < 30; attempt++) {
    try { devices = await handlers['browser:devices'](); if (devices.length) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert(devices?.length > 10, 'reads Chromium devices')
  const device = devices.find(item => item.title.includes('iPhone')) || devices[0]
  handlers['browser:emulate']({}, guest.id, device)
  assert.equal(await guest.executeJavaScript('screen.width'), device.width)
  assert.equal(await guest.executeJavaScript('devicePixelRatio'), device.deviceScaleFactor)
  handlers['browser:emulate']({}, guest.id, null)
  console.log(`PASS: SQLite navigation capture, ${devices.length} real DevTools devices, screen width and pixel ratio emulation`)
  const row = handlers['browser:history:list']()[0]
  handlers['browser:history:delete']({}, row.id)
  assert.equal(handlers['browser:history:list']().length, 0)
  host.destroy(); server.close(); app.quit()
}).catch(error => { console.error(error); app.exit(1) })
setTimeout(() => { console.error('Timed out'); app.exit(1) }, 30000).unref()
