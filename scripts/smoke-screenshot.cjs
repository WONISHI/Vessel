const {app,BrowserWindow,desktopCapturer,nativeImage,screen,clipboard,systemPreferences,dialog}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module'),ts=require('typescript')
app.setPath('userData',fs.mkdtempSync(path.join(require('node:os').tmpdir(),'vessel-shot-')))
app.on('window-all-closed',()=>{})
const wait=ms=>new Promise(r=>setTimeout(r,ms))
app.whenReady().then(async()=>{
 const display=screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
 desktopCapturer.getSources=async()=>[{display_id:String(display.id),thumbnail:nativeImage.createFromBitmap(Buffer.alloc(800*600*4,220),{width:800,height:600})}]
 const mod=new Module(path.resolve('out/main/shot-smoke.cjs'),module);mod.filename=path.resolve('out/main/shot-smoke.cjs');mod.paths=module.paths
 mod._compile(ts.transpileModule(fs.readFileSync('src/main/screenshot.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,mod.filename)
 const originalPermission=systemPreferences.getMediaAccessStatus
 const originalDialog=dialog.showMessageBox
 let deniedMessage=false, sourceCalled=false
 systemPreferences.getMediaAccessStatus=()=> 'denied'
 dialog.showMessageBox=async options=>{deniedMessage=options.title==='需要屏幕录制权限';return {response:1}}
 const sourceGetter=desktopCapturer.getSources
 desktopCapturer.getSources=async()=>{sourceCalled=true;return sourceGetter()}
 await mod.exports.startScreenshot()
 assert(deniedMessage);assert(!sourceCalled);assert.equal(BrowserWindow.getAllWindows().length,0)
 systemPreferences.getMediaAccessStatus=()=> 'granted'
 dialog.showMessageBox=originalDialog
 // Exercise the authorized fallback without capturing any real screen pixels.
 const child=require('node:child_process'), originalExec=child.execFile
 let fallbackFile
 child.execFile=(command,args,_options,callback)=>{assert.equal(command,'/usr/sbin/screencapture');assert(args.includes('-R'));fallbackFile=args.at(-1);fs.writeFileSync(fallbackFile,nativeImage.createFromBitmap(Buffer.alloc(800*600*4,220),{width:800,height:600}).toPNG());callback(null,'','')}
 desktopCapturer.getSources=async()=>{throw new Error('Failed to get sources.')}
 await mod.exports.startScreenshot();await wait(1000)
 assert(fallbackFile && !fs.existsSync(fallbackFile),'temporary capture is cleaned up')
 child.execFile=originalExec;desktopCapturer.getSources=sourceGetter;systemPreferences.getMediaAccessStatus=originalPermission
 const win=BrowserWindow.getAllWindows()[0]
 assert(win)
 const js=s=>win.webContents.executeJavaScript(s)
 console.log(await js(`Array.from(document.querySelectorAll('canvas')).map(c=>({id:c.id,width:c.width,height:c.height}))`))
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:120,y:120})
 win.webContents.sendInputEvent({type:'mouseMove',modifiers:['leftButtonDown'],x:420,y:320})
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:420,y:320});await wait(400)
 fs.writeFileSync('/tmp/vessel-shot-selection.png',(await win.webContents.capturePage()).toPNG())
 console.log(await js(`Array.from(document.querySelectorAll('[title]')).map(e=>({title:e.title,id:e.id}))`))
 await js(`document.querySelector('.shot-pin').click()`);await wait(800)
 const pin=BrowserWindow.getAllWindows().find(w=>w!==win)
 assert(pin,'Confirmation creates pinned image window')
 assert(pin.isAlwaysOnTop())
 assert(!clipboard.readImage().isEmpty())
 assert(await pin.webContents.executeJavaScript(`!!document.querySelector('.pin-image')`))
 await pin.webContents.executeJavaScript(`document.querySelectorAll('button')[1].click()`);await wait(100)
 console.log('PASS actual js-screen-shot selection, confirmation, clipboard image, always-on-top pin and close')
 app.quit()
}).catch(e=>{console.error(e);app.exit(1)})
setTimeout(()=>app.exit(1),20000).unref()
