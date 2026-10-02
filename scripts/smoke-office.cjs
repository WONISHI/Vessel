const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
app.whenReady().then(async () => {
 const mod = new Module(path.resolve('out/main/office-smoke.cjs'), module)
 mod.filename = path.resolve('out/main/office-smoke.cjs'); mod.paths = module.paths
 mod._compile(ts.transpile(fs.readFileSync('src/main/office.ts','utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }), mod.filename)
 let open
 mod.exports.registerOffice({ ipc: { handle: (_name, callback) => { open = callback } } })
 await open()
 const win = BrowserWindow.getAllWindows()[0]
 win.webContents.on('console-message', (_e, level, message) => { if(level >= 2) console.log(message.slice(0,500)) })
 win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
   if (/^https?:/.test(details.url) && !details.url.startsWith('http://127.0.0.1:')) { console.log('BLOCKED REMOTE:', details.url); callback({cancel:true}) } else callback({})
 })
 await new Promise(r => setTimeout(r,1000))
 await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b => b.textContent==='新建文档').click()")
 await new Promise(r => setTimeout(r,20000))
 console.log(await win.webContents.executeJavaScript("document.body.innerText"))
 console.log(await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('iframe')).map(f => ({url:f.src,text:f.contentDocument?.body?.innerText.slice(0,1200)}))"))
 fs.writeFileSync('/tmp/vessel-office.png',(await win.webContents.capturePage()).toPNG())
 app.exit(0)
}).catch(e => { console.error(e); app.exit(1) })
