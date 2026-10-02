// electron scripts/smoke-transit.cjs — isolated profile, local test page only.
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const profile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'vessel-transit-'))
app.setPath('userData', profile)
let clipboardText = ''
const delay = ms => new Promise(r => setTimeout(r, ms))
let server
const watchdog = setTimeout(() => { console.error('Transit smoke timed out'); app.exit(1) }, 45000)
app.whenReady().then(async () => {
  const handlers = { 'browser:extensions:list': [], 'markdown:pending': [], 'workspace:readDirectory': [], 'app-state:get': null, 'app-state:set': undefined, 'files:watch': 'test', 'files:unwatch': undefined }
  for (const [name, value] of Object.entries(handlers)) ipcMain.handle(name, () => value)
  const win = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { preload: path.resolve('out/preload/index.js'), sandbox: false, webviewTag: true } })
  const Module = require('node:module')
  const compiled = new Module(path.resolve('out/main/transit-test.cjs'), module)
  compiled.filename = path.resolve('out/main/transit-test.cjs'); compiled.paths = module.paths
  compiled._compile(require('typescript').transpile(fs.readFileSync('src/main/transit.ts', 'utf8'), { module: 1, target: 9 }), compiled.filename)
  compiled.exports.registerTransit(win.webContents)
  win.webContents.ipc.removeHandler("transit:clipboard")
  win.webContents.ipc.handle("transit:clipboard", () => clipboardText)
  win.webContents.on('will-attach-webview', (_e, prefs) => { prefs.nodeIntegration = false; prefs.sandbox = true; prefs.contextIsolation = true })
  server = require('node:http').createServer((_req, res) => res.end('<title>Transit local fixture</title><h1>Local reference page</h1>'))
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  await win.loadFile(path.resolve('out/renderer/index.html'))
  const js = code => win.webContents.executeJavaScript(code)
  const assert = async (code, message) => { if (!await js(code)) throw new Error(message); console.log('PASS', message) }
  await js(`localStorage.setItem('app_current_workspace', JSON.stringify({name:'Transit test',path:'/tmp',files:[]})); location.hash='/editor'`)
  await delay(1500)
  const open = async () => { await js(`document.querySelector('button[aria-label^="中转站，"]').click()`); await delay(300) }
  const read = async () => { await js(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('读取剪贴板')).click()`); await delay(500) }
  clipboardText = 'Reference note\nSecond line'
  await open(); await read()
  await assert(`document.querySelector('[role="dialog"]').textContent.includes('Second line')`, 'clipboard text opens side panel')
  await assert(`!document.querySelector('[data-state="open"].bg-black\\/80')`, 'non-modal panel has no backdrop')
  await js(`document.querySelector('button[aria-label="停靠左侧"]').click()`)
  await assert(`Math.round(document.querySelector('[role="dialog"]').getBoundingClientRect().left) === 52`, 'left docking preserves activity bar')
  await js(`document.querySelector('button[aria-label="展开"]').click()`)
  await assert(`document.querySelector('[role="dialog"]').getBoundingClientRect().width > 1000`, 'expand panel')
  await js(`document.querySelector('button[aria-label="还原"]').click(); document.querySelector('button[aria-label="停靠右侧"]').click()`)
  await open(); await read()
  await assert(`JSON.parse(localStorage.getItem('vessel-transit-v1')).length === 1`, 'duplicate clipboard content is not added twice')
  clipboardText = `http://127.0.0.1:${server.address().port}`
  await open(); await read(); await delay(1200)
  await assert(`document.querySelector('webview').getTitle() === 'Transit local fixture'`, 'URL loads real webview')
  fs.writeFileSync('/tmp/vessel-transit-panel.png', (await win.webContents.capturePage()).toPNG())
  await js(`document.querySelector('button[aria-label="独立窗口"]').click()`); await delay(500)
  if (BrowserWindow.getAllWindows().length !== 2) throw new Error('Independent window missing')
  console.log('PASS independent window')
  BrowserWindow.getAllWindows().find(w => w !== win).destroy()
  await open()
  await js(`document.querySelector('button[aria-label="删除 Reference note"]').click()`)
  await assert(`JSON.parse(localStorage.getItem('vessel-transit-v1')).length === 1`, 'delete item persists')
  fs.writeFileSync('/tmp/vessel-transit-list.png', (await win.webContents.capturePage()).toPNG())
  await win.reload(); await delay(1500)
  await assert(`document.querySelector('button[aria-label="中转站，1 个"]') !== null`, 'list survives renderer reload')
  win.destroy(); app.quit()
}).catch(error => { console.error(error); app.exit(1) })
app.on('will-quit', () => { clearTimeout(watchdog); server?.close(); fs.rmSync(profile, { recursive: true, force: true }) })
