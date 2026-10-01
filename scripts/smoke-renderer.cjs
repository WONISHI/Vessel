// Run with Electron, not Node: electron scripts/smoke-renderer.cjs
// Uses a temporary profile so startup verification cannot change user workspaces.
const { app, BrowserWindow, ipcMain } = require('electron')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const profile = mkdtempSync(join(tmpdir(), 'vessel-renderer-smoke-'))
app.setPath('userData', profile)
let failed = false
app.on('will-quit', () => rmSync(profile, { recursive: true, force: true }))
app.whenReady().then(async () => {
  ipcMain.handle('markdown:pending', () => [])
  ipcMain.handle('workspace:readDirectory', () => [])
  ipcMain.handle('app-state:get', () => null)
  ipcMain.handle('app-state:set', () => undefined)
  const window = new BrowserWindow({ show: false, webPreferences: {
    preload: resolve(__dirname, '../out/preload/index.js'), sandbox: false,
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
  window.destroy()
  rmSync(profile, { recursive: true, force: true })
  app.exit(failed ? 1 : 0)
}).catch(error => { console.error(error); app.exit(1) })
