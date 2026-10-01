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
  const extensionPath = join(profile, 'test-extension')
  mkdirSync(extensionPath)
  writeFileSync(join(extensionPath, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Vessel test extension', version: '1.0', content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['content.js'] }] }))
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
