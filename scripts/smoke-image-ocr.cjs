const { app, BrowserWindow, ipcMain, session } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'vessel-ocr-')))
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']}, (_details, callback) => callback({cancel:true}))
  const file = process.argv[2]
  if (!file) throw new Error('Pass an OCR screenshot fixture')
  const handlers = { 'settings:get': {theme:'light',font:'Plus Jakarta Sans',fontSize:14,accent:'#16a34a'}, 'app-state:get':null, 'app-state:set':null, 'markdown:pending':[], 'image:clipboard':'data:image/png;base64,'+fs.readFileSync(file).toString('base64') }
  for (const [name,value] of Object.entries(handlers)) ipcMain.handle(name,()=>value)
  const win = new BrowserWindow({show:false,width:1200,height:800,webPreferences:{preload:path.resolve('out/preload/index.js'),sandbox:false}})
  win.webContents.on('console-message', (_e, _l, message)=>console.log(message))
  await win.loadFile(path.resolve('out/renderer/index.html'), {hash:'/devtools/ocr'})
  const js = code => win.webContents.executeJavaScript(code)
  await new Promise(r=>setTimeout(r,1000))
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('读取剪贴板')).click()`)
  await new Promise(r=>setTimeout(r,500))
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开始识别')).click()`)
  const started=Date.now()
  let text=''
  while(Date.now()-started<125000) {
    await new Promise(r=>setTimeout(r,500))
    text=await js(`document.querySelector('textarea[aria-label="识别结果"]')?.value || ''`)
    if(text) break
    const error=await js(`document.querySelector('[data-sonner-toast]')?.textContent || ''`)
    if(error) throw new Error(error)
  }
  assert(text.includes('OCR'), text || 'No OCR output')
  assert(/[\u4e00-\u9fff]/.test(text))
  await js(`document.querySelector('textarea').value += '\\n可编辑'`)
  assert(await js(`document.querySelector('textarea').value.endsWith('可编辑')`))
  console.log('PASS: bundled offline OCR recognizes Chinese and English; editable Textarea', Date.now()-started, 'ms')
  fs.writeFileSync('/tmp/vessel-esearch-ocr.png',(await win.webContents.capturePage()).toPNG())
  app.quit()
}).catch(e=>{console.error(e);app.exit(1)})
