const {app,BrowserWindow,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),Module=require('node:module'),ts=require('typescript')
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vessel-open-'))
app.setPath('userData',profile);app.setAppPath(process.cwd())
const wait=ms=>new Promise(r=>setTimeout(r,ms))
app.whenReady().then(async()=>{
 const files=['first.md','second.md'].map(name=>({name,path:path.join(profile,name),type:'file'}))
 files.forEach(f=>fs.writeFileSync(f.path,'# '+f.name))
 const state=new Map()
 for(const [name,handler] of Object.entries({
  'settings:get':()=>({theme:'light',fontSize:14,accent:'#16a34a'}),'markdown:pending':()=>files.map(f=>f.path),
  'app-state:get':(_e,key)=>state.get(key)||null,'app-state:set':(_e,key,value)=>state.set(key,value),
  'workspace:readDirectory':()=>files,'file:readContent':(_e,file)=>fs.readFileSync(file,'utf8'),
  'files:watch':()=> 'watch','files:unwatch':()=>{}
 }))ipcMain.handle(name,handler)
 const win=new BrowserWindow({show:true,width:1200,height:800,webPreferences:{preload:path.resolve('out/preload/index.js'),sandbox:false}})
 const mod=new Module(path.resolve('out/main/office-open-smoke.cjs'),module);mod.filename=path.resolve('out/main/office-open-smoke.cjs');mod.paths=module.paths
 mod._compile(ts.transpileModule(fs.readFileSync('src/main/office.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText,mod.filename)
 mod.exports.registerOffice(win.webContents)
 const js=code=>win.webContents.executeJavaScript(code)
 await win.loadFile(path.resolve('out/renderer/index.html'),{hash:'/image'})
 for(let i=0;i<40;i++){await wait(200);if(await js(`document.body.textContent.includes('second.md')`))break}
 assert.equal(await js(`location.hash`),'#/resources/file')
 await wait(800)
 const saved=[...state].filter(([k])=>k.startsWith('resources-tabs:')).map(([,v])=>v)
 assert(saved.some(v=>JSON.stringify(v).includes('first.md')&&JSON.stringify(v).includes('second.md')),JSON.stringify(saved))
 assert(state.get('project-library').some(p=>p.path===profile))
 const fixture=new BrowserWindow({show:false});await fixture.loadURL('data:text/html,<h1>External PDF fixture</h1>')
 const pdf=path.join(profile,'preview.pdf');fs.writeFileSync(pdf,await fixture.webContents.printToPDF({}));fixture.destroy()
 win.webContents.send('markdown:open',pdf)
 for(let i=0;i<80;i++){await wait(250);if(await js(`document.querySelector('iframe[title="ONLYOFFICE 本地编辑器"]')?.contentWindow ? location.hash==='#/office' : false`))break}
 await wait(2200)
 const office=win.webContents.mainFrame.frames.find(f=>f.url.includes('/office.html'))
 assert(office,'office frame exists')
 for(let i=0;i<40;i++){if(await office.executeJavaScript(`!!document.querySelector('.react-pdf__Page canvas')`))break;await wait(250)}
 assert(await office.executeJavaScript(`document.querySelector('.react-pdf__Page canvas')?.width>0`))
 console.log('PASS external Markdown batch retains both resource tabs; external PDF opens directly in ONLYOFFICE')
 app.exit(0)
}).catch(e=>{console.error(e);app.exit(1)})
setTimeout(()=>app.exit(1),45000).unref()
