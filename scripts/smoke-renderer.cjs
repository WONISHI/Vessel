// Run with Electron, not Node: electron scripts/smoke-renderer.cjs
// Uses a temporary profile so startup verification cannot change user workspaces.
const { app, BrowserWindow, ipcMain, session, webContents } = require('electron')
const { mkdtempSync, rmSync, mkdirSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const profile = mkdtempSync(join(tmpdir(), 'vessel-renderer-smoke-'))
app.setPath('userData', profile)
let failed = false
app.on('will-quit', () => rmSync(profile, { recursive: true, force: true }))
app.whenReady().then(async () => {
  ipcMain.handle("browser:extensions:list", () => [])
  ipcMain.handle("files:watch", () => "smoke-watch")
  ipcMain.handle("files:unwatch", () => undefined)
  ipcMain.handle("browser:devtools", () => undefined)
  ipcMain.handle('markdown:pending', () => [])
  ipcMain.handle('workspace:readDirectory', () => [])
  ipcMain.handle('app-state:get', () => null)
  ipcMain.handle('app-state:set', () => undefined)
  const window = new BrowserWindow({ show: false, webPreferences: {
    preload: resolve(__dirname, '../out/preload/index.js'), sandbox: false, webviewTag: true,
  } })
  app.setAppPath(process.cwd())
  const officeModule = new (require('node:module'))(resolve(__dirname, '../out/main/office-test.cjs'), module)
  officeModule.filename = resolve(__dirname, '../out/main/office-test.cjs'); officeModule.paths = module.paths
  officeModule._compile(require('typescript').transpile(require('node:fs').readFileSync(resolve(__dirname, '../src/main/office.ts'), 'utf8'), { module: 1, target: 9 }), officeModule.filename)
  officeModule.exports.registerOffice(window.webContents)
  window.webContents.on('console-message', (_event, level, message) => {
    if (level === 3) { failed = true; console.error(message) }
  })
  await window.loadFile(resolve(__dirname, '../out/renderer/index.html'))
  await new Promise(resolve => setTimeout(resolve, 3000))
  const text = await window.webContents.executeJavaScript('document.body.innerText.trim()')
  if (!text) { failed = true; console.error('Renderer is blank') }
  else console.log('Renderer mounted:', text.slice(0, 200))
  await window.webContents.executeJavaScript(`localStorage.setItem('app_current_workspace', JSON.stringify({name:'Smoke workspace',path:'/tmp',files:[]})); location.hash='/editor'`)
  await new Promise(resolve => setTimeout(resolve, 2000))
  const workspaceText = await window.webContents.executeJavaScript('document.body.innerText')
  if (!workspaceText.includes('控制台')) { failed = true; console.error('Workspace status bar did not mount:', workspaceText) }
  else console.log('Workspace and live clock mounted:', workspaceText.slice(-200))
  await window.webContents.executeJavaScript(`localStorage.setItem('resource_current_project', JSON.stringify({name:'Independent library',path:'/tmp',files:[]})); location.hash='/resources'`)
  await new Promise(resolve => setTimeout(resolve, 2000))
  const resourceText = await window.webContents.executeJavaScript('document.body.innerText')
  if (!resourceText.includes('Independent library') || !resourceText.includes('控制台')) { failed = true; console.error('Resource page did not mount:', resourceText) }
  else console.log('Independent resource page mounted')
  await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="ONLYOFFICE"]').click()`)
  await new Promise(resolve => setTimeout(resolve, 1800))
  const officeState = await window.webContents.executeJavaScript(`({hash:location.hash,text:document.body.innerText,frame:!!document.querySelector('iframe[title="ONLYOFFICE 本地编辑器"]'),visible:[...document.querySelectorAll('nav')].map(el => !!el.getBoundingClientRect().width)})`)
  console.log('Office via activity bar:', officeState)
  if (!officeState.frame || !officeState.visible.some(Boolean)) { failed = true; console.error('Office route did not mount') }
  const officeFrame = window.webContents.mainFrame.frames.find(frame => frame.url.includes('/office.html'))
  if (!officeFrame || !(await officeFrame.executeJavaScript('document.body.innerText')).includes('打开本地文件')) { failed = true; console.error('Office iframe failed to load') }
  else console.log('Embedded Office start page loaded successfully')
  writeFileSync('/tmp/vessel-office-embedded.png', (await window.webContents.capturePage()).toPNG())
  const extensionPath = join(profile, 'test-extension')
  mkdirSync(extensionPath)
  writeFileSync(join(extensionPath, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Vessel test extension', version: '1.0', content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['content.js'] }] }))
  writeFileSync(join(extensionPath, 'popup.html'), '<html><body>Extension popup<script src="popup.js"></script></body></html>')
  writeFileSync(join(extensionPath, 'popup.js'), 'location.replace("welcome.html")')
  writeFileSync(join(extensionPath, 'welcome.html'), '<html><body>Extension welcome<script src="welcome.js"></script></body></html>')
  writeFileSync(join(extensionPath, 'welcome.js'), 'document.body.dataset.extensionId = chrome.runtime.id; document.body.innerHTML += `<a id=login href="login.html" target=igghelperlogin>Login</a>`')
  writeFileSync(join(extensionPath, 'content.js'), "document.documentElement.dataset.vesselExtension = 'loaded'")
  const extension = await session.fromPartition('persist:vessel-browser').extensions.loadExtension(extensionPath)
  const server = require('node:http').createServer((_request, response) => response.end('<html><title>Guest regression</title><body>Guest ready</body></html>'))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  await window.webContents.executeJavaScript("location.hash='/browser'")
  await new Promise(resolve => setTimeout(resolve, 500))
  for (let i = 0; i < 2; i++) {
    window.webContents.send('browser:new-tab', `http://127.0.0.1:${server.address().port}/?tab=${i}`)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  const browserText = await window.webContents.executeJavaScript('document.body.innerText')
  if (browserText.includes('Unexpected Application Error') || !browserText.includes('Guest regression')) { failed = true; console.error('Browser guest regression:', browserText) }
  else console.log('Browser new-tab guest lifecycle mounted without crash')
  const guestId = await window.webContents.executeJavaScript("Array.from(document.querySelectorAll('webview')).at(-1).getWebContentsId()")
  const guest = webContents.fromId(guestId)
  if (await guest.executeJavaScript("document.documentElement.dataset.vesselExtension") !== 'loaded') { failed = true; console.error('Extension content script did not execute') }
  else console.log('Unpacked extension content script executed in browser session')
  const popup = new BrowserWindow({ show: false, webPreferences: { partition: 'persist:vessel-browser', sandbox: true, contextIsolation: true, nodeIntegration: false } })
  const ts = require('typescript')
  const loader = { exports: {} }
  const helperSource = require('node:fs').readFileSync(resolve(__dirname, '../src/main/extension-navigation.ts'), 'utf8')
  new Function('exports', ts.transpile(helperSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(loader.exports)
  await loader.exports.loadExtensionPage(popup.webContents, `chrome-extension://${extension.id}/popup.html`)
  if (await popup.webContents.executeJavaScript('document.body.dataset.extensionId') !== extension.id) { failed = true; console.error('Extension popup runtime unavailable') }
  else console.log('Extension popup loaded with its own chrome.runtime in browser session')
  writeFileSync(join(extensionPath, 'login.html'), '<html><body>Login destination</body></html>')
  loader.exports.handleExtensionWindows(popup.webContents, extension.id, () => {})
  await popup.webContents.executeJavaScript("document.getElementById('login').click()")
  await new Promise(resolve => setTimeout(resolve, 500))
  if (!popup.webContents.getURL().endsWith('/login.html')) { failed = true; console.error('Named extension login target failed') }
  else console.log('Named extension login link navigates to login page')
  popup.destroy()
  await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="管理浏览器扩展"]').click()`)
  await new Promise(resolve => setTimeout(resolve, 600))
  const sheet = await window.webContents.executeJavaScript(`(() => { const el = document.querySelector('[role="dialog"]'); return { visible: !!el, right: el?.getBoundingClientRect().right, width: innerWidth, locked: document.body.style.pointerEvents === 'none', overlay: Array.from(document.querySelectorAll('[data-state="open"]')).some(el => el.classList.contains("bg-black/80")) } })()`)
  if (!sheet.visible || sheet.locked || sheet.overlay || Math.abs(sheet.right - sheet.width) > 2) { failed = true; console.error('Nonmodal sheet mismatch:', sheet) }
  else console.log('Extension Sheet is right aligned, without overlay or page pointer lock')
  writeFileSync('/tmp/vessel-extensions-sheet.png', (await window.webContents.capturePage()).toPNG())
  await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="管理浏览器扩展"]').click()`)
  session.fromPartition('persist:vessel-browser').extensions.removeExtension(extension.id)
  await window.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true}))")
  await new Promise(resolve => setTimeout(resolve, 200))
  if (!await window.webContents.executeJavaScript("!!document.querySelector('.browser-find')")) { failed = true; console.error('Find overlay did not open') }
  window.webContents.sendInputEvent({ type: 'char', keyCode: 'Guest' })
  await new Promise(resolve => setTimeout(resolve, 500))
  const findCount = await window.webContents.executeJavaScript("document.querySelector('.browser-find-count')?.textContent")
  if (findCount !== '1/1') { failed = true; console.error('Find count mismatch:', findCount) }
  else console.log('Find overlay matches real guest text: 1/1')
  writeFileSync('/tmp/vessel-browser-find.png', (await window.webContents.capturePage()).toPNG())
  await window.webContents.executeJavaScript(`document.querySelector('button[title="关闭标签页"]')?.click()`)
  await new Promise(resolve => setTimeout(resolve, 300))
  server.close()
  window.destroy()
  rmSync(profile, { recursive: true, force: true })
  app.exit(failed ? 1 : 0)
}).catch(error => { console.error(error); app.exit(1) })
