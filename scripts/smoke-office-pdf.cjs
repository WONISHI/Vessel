const { app, BrowserWindow, dialog } = require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module'),ts=require('typescript')
const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'vessel-office-pdf-'))
app.setPath('userData',profile);app.setAppPath(process.cwd())
app.on('window-all-closed',()=>{})
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
app.whenReady().then(async()=>{
 const fixture=new BrowserWindow({show:false})
 await fixture.loadURL('data:text/html,<h1>Vessel PDF document</h1><p>Local PDF preview.</p>')
 const bytes=await fixture.webContents.printToPDF({});fixture.destroy()
 const file=path.join(profile,'preview.pdf');fs.writeFileSync(file,bytes)
 const mod=new Module(path.resolve('out/main/office-pdf-smoke.cjs'),module);mod.filename=path.resolve('out/main/office-pdf-smoke.cjs');mod.paths=module.paths
 mod._compile(ts.transpileModule(fs.readFileSync('src/main/office.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText,mod.filename)
 const win=new BrowserWindow({show:false,width:1100,height:800})
 const handlers=new Map()
 mod.exports.registerOffice(win.webContents)
 // Native picker still authorizes the file through the real main-process handler.
 dialog.showOpenDialog=async(_owner,options)=>{assert(options.filters[0].extensions.includes('pdf'));return {canceled:false,filePaths:[file]}}
 mod.exports.registerOffice({ipc:{handle:(name,fn)=>handlers.set(name,fn)}})
 // Use the real window for owner resolution on the temporary handler host.
 const original=BrowserWindow.fromWebContents;BrowserWindow.fromWebContents=()=>win
 const picked=await handlers.get('office:pick')()
 BrowserWindow.fromWebContents=original
 await win.loadURL(await handlers.get('office:open')())
 const js=code=>win.webContents.executeJavaScript(code)
 await js(`window.addEventListener('message',e=>{if(e.source===window&&e.data?.type==='office:pick')e.ports[0].postMessage({result:{name:'preview.pdf',token:'test',bytes:new Uint8Array(${JSON.stringify([...picked.bytes])})}})})`)
 await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='打开文件').click()`)
 for(let i=0;i<30;i++){await wait(300);if(await js(`!!document.querySelector('.react-pdf__Page canvas')`))break}
 assert(await js(`document.querySelector('.react-pdf__Page canvas').width>0`))
 assert.match(await js(`document.querySelector('.react-pdf__Page__textContent').textContent`),/Vessel PDF document/)
 assert.equal(await js(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='保存')`),false)
 await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='打开文件').click()`);await wait(800)
 assert.equal(await js(`document.querySelectorAll('[role=tab]').length`),2)
 assert.equal(await js(`Array.from(document.querySelectorAll('.react-pdf__Document')).filter(e=>e.getBoundingClientRect().height>0).length`),1)
 fs.writeFileSync('/tmp/vessel-office-pdf.png',(await win.webContents.capturePage()).toPNG())
 console.log('PASS native PDF picker, react-pdf rendering/text, PDF tab switching and read-only controls')
 app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
setTimeout(()=>app.exit(1),30000).unref()
