const {app,BrowserWindow,ipcMain,nativeImage,clipboard}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
app.setPath('userData',fs.mkdtempSync(path.join(require('node:os').tmpdir(),'vessel-nav-')))
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
app.whenReady().then(async()=>{
 const file={name:'test.md',path:'/fixture/test.md'},state=new Map();let reads=0
 const source='# Workspace fixture\n\n'+Array.from({length:12},(_,i)=>`Paragraph ${i}\n\n`).join('')+'```js\nconst selected = 123;\nconsole.log(selected);\n```\n\n![[fixture.png]]\n\nEnd\n\n| Name | Value |\n| --- | --- |\n| First | One |\n'
 const image=nativeImage.createFromBitmap(Buffer.alloc(320*180*4,240),{width:320,height:180}).toDataURL()
 for(const [name,fn] of Object.entries({
 'settings:get':()=>({theme:'light',fontSize:14,accent:'#16a34a'}),'markdown:pending':()=>[],
 'app-state:get':(_e,key)=>key.startsWith('workspace-tabs:')?{files:[file],active:file.path}:state.get(key)||null,
 'app-state:set':(_e,key,value)=>state.set(key,value),'workspace:readDirectory':()=>[file],
 'workspace:createEntry':(_e,root,parent,name,kind)=>{state.set('created',{name,kind});return {name,path:parent+'/'+name,type:kind}},
 'files:watch':()=> 'watch','files:unwatch':()=>{},'file:readContent':()=>{reads++;return process.env.VESSEL_EMPTY_TEST ? "" : source},'file:saveContent':(_e,...args)=>{state.set("saved",args)},
 'obsidian:readImage':()=>image,'browser:extensions:list':()=>[],'browser:proxy:state':()=>({connected:false,nodes:[]})
 }))ipcMain.handle(name,fn)
 const win=new BrowserWindow({show:true,width:1300,height:850,webPreferences:{preload:path.resolve('out/preload/index.js'),sandbox:false,webviewTag:true}})
 win.webContents.on("console-message",(_e,level,message)=>{if(level>=2)console.log(message)})
 const js=code=>win.webContents.executeJavaScript(code)
 await win.loadFile(path.resolve('out/renderer/index.html'),{hash:'/image'})
 await js(`localStorage.setItem('app_current_workspace',${JSON.stringify(JSON.stringify({name:'fixture',path:'/fixture',files:[file]}))});location.hash='/editor'`)
 if(process.env.VESSEL_EMPTY_TEST){
  for(let i=0;i<40;i++){await wait(250);if(await js(`!!document.querySelector('.vditor-ir [contenteditable=true]')`))break}
  await wait(500)
  const point=await js(`(()=>{const e=document.querySelector('.vditor-ir [contenteditable=true]');const r=e.getBoundingClientRect();return {x:Math.round(r.x+100),y:Math.round(r.y+100),height:r.height}})()`)
  assert(point.height>200)
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:point.x,y:point.y})
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:point.x,y:point.y})
  await win.webContents.insertText('New document edit')
  await wait(1200)
  assert(await js(`document.querySelector('.vditor-ir').textContent.includes('New document edit')`))
  assert(JSON.stringify(state.get('saved')).includes('New document edit'))
  console.log('PASS empty Markdown click, type and save');app.exit(0);return
 }
 for(let i=0;i<40;i++){await wait(250);if(await js(`!!document.querySelector('.vessel-code-frame')`))break}
 assert(await js(`!!document.querySelector('.vessel-code-frame')`))
 if(process.env.VESSEL_CREATE_TEST){
  await js(`document.querySelector('button[aria-label="新建文件"]').click()`);await wait(200)
  await js(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='新建自定义文件').click()`);await wait(200)
  await js(`document.querySelector('[aria-label="新文件名称"]').focus()`)
  await win.webContents.insertText('notes.custom');await wait(100)
  await js(`document.querySelector('[aria-label="新文件名称"]').form.requestSubmit()`);await wait(300)
  assert.deepEqual(state.get('created'),{name:'notes.custom',kind:'file'})
  console.log('PASS create custom file with exact editable extension');app.exit(0);return
 }
 await js(`window.fixtureEditor=document.querySelector('.vditor');window.fixtureFrame=document.querySelector('.vessel-code-frame')`)
 await js(`document.querySelector('.vditor-ir table').scrollIntoView({block:'center'})`);await wait(200)
 const tableHover = async edge => {
   const point=await js(`(()=>{const r=document.querySelector('.vditor-ir table').getBoundingClientRect();return {x:Math.round(${edge == 'row' ? 'r.left+50' : 'r.right+8'}),y:Math.round(${edge == 'row' ? 'r.bottom+8' : 'r.top+20'})}})()`)
   win.webContents.sendInputEvent({type:'mouseMove',...point});await wait(100)
   await js(`document.querySelector('[aria-label="${edge == 'row' ? '在下方新增行' : '在右侧新增列'}"]').click()`);await wait(200)
 }
 await tableHover('row');assert.equal(await js(`document.querySelector('.vditor-ir table').rows.length`),3)
 await tableHover('column');assert.equal(await js(`document.querySelector('.vditor-ir table').rows[0].cells.length`),3)
 console.log('PASS Markdown table edge add row and column')
 const before=reads
 const activity=async label=>{await js(`Array.from(document.querySelectorAll('nav[aria-label="工作台活动栏"] button')).find(e=>e.getAttribute("aria-label")===${JSON.stringify(label)}&&e.getClientRects().length).click()`);await wait(400)}
 await activity('图片');await activity('开发工具')
 assert.equal(await js(`location.hash`),'#/devtools/json')
 assert.equal(await js(`getComputedStyle(document.querySelector('.dev-tools aside')).backgroundColor`),'rgb(250, 250, 249)')
 await activity('工作区');await wait(300)
 assert(await js(`window.fixtureEditor===document.querySelector('.vditor')`),'editor survives activity navigation')
 assert.equal(reads,before,'returning does not reload file')
 await js(`document.querySelector('.vessel-code-frame').scrollIntoView({block:'center'})`)
 const rect=await js(`(()=>{const r=document.querySelector('.vessel-code-frame code').getBoundingClientRect();return {x:r.x+2,y:r.y+8,end:r.right-10}})()`)
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:Math.round(rect.x),y:Math.round(rect.y)})
 win.webContents.sendInputEvent({type:'mouseMove',modifiers:['leftButtonDown'],x:Math.round(Math.min(rect.x+200,rect.end)),y:Math.round(rect.y+22)})
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:Math.round(Math.min(rect.x+200,rect.end)),y:Math.round(rect.y+22)});await wait(200)
 assert((await js('getSelection().toString()')).length>0,'code supports mouse selection')
 win.webContents.copy();await wait(100);assert(clipboard.readText().includes('selected'))
 await js(`document.querySelector('.vessel-image-block').scrollIntoView({block:'center'})`);await wait(500)
 const imageRect=await js(`(()=>{const i=document.querySelector('.vessel-image-block img[decoding]');const r=i.getBoundingClientRect();window.scrollHost=i.closest('.vditor-ir');window.oldScroll=scrollHost.scrollTop;return {x:r.x+20,y:r.y+20}})()`)
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:Math.round(imageRect.x),y:Math.round(imageRect.y)});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:Math.round(imageRect.x),y:Math.round(imageRect.y)});await wait(200)
 assert(await js(`Math.abs(scrollHost.scrollTop-oldScroll)<50`),'image click preserves scroll')
 await js(`document.querySelector('.vessel-image-block img[decoding]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:600,clientY:400}))`);await wait(150)
 assert.equal(await js(`document.querySelectorAll('[role=menuitem]').length`),7)
 await js(`Array.from(document.querySelectorAll('[role=menuitem]')).find(e=>e.textContent==='压缩').click()`);await wait(300)
 assert(await js(`Array.from(document.querySelectorAll('.image-tool-nav button[aria-pressed=true]')).some(e=>e.getClientRects().length && e.textContent.trim()==='压缩')`))
 console.log('PASS workspace retained/no reread, image→tools route/sidebar, code drag/copy, image scroll/context toolbox')
 app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
setTimeout(()=>app.exit(1),30000).unref()
