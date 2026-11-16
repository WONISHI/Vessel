/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")
const { spawn } = require("node:child_process")
const root = path.resolve()
const directory = process.env.VESSEL_TREE_SMOKE || fs.mkdtempSync(path.join(require("node:os").tmpdir(), "vessel-tree-smoke-"))

if (!process.argv.includes("--run")) {
  const source = `
    import React, { useEffect, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { VirtualTree } from '@/components/ui/tree';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import FileTreeItem from '@/components/workspace/components/layout-aside/layout-workspace-sidebar/file-tree-item';
    import { setDirectoryTreeSettings, useDirectoryTreeLayout, useDirectoryTreeSidebarWidth } from '@/features/directory-tree/state';
    import { normalizeDirectoryTreeSettings } from '@vessel/utils';
    import { DirectoryTreeSettingsPanel } from '@/pages/settings/components/directory-tree-settings';
    import { FileIconScope } from '@/features/file-icons/state';
    const chain = ['src', 'components', 'workspace', 'layout-aside', 'layout-workspace-sidebar', 'features', 'browser', 'navigation', 'history', 'services', 'shared', 'hooks'];
    let parent = '/Vessel';
    const rows = chain.map((name, depth) => { parent += '/' + name; return { id: parent, depth, expanded: true, item: { path: parent, name, type: 'directory' } }; });
    const deep = parent + '/use-browser-history-and-navigation.ts';
    rows.push({id:deep,depth:chain.length,item:{name:'use-browser-history-and-navigation.ts',path:deep,type:'file'}});
    rows.push({id:'/Vessel/README.md',depth:0,item:{name:'README.md',path:'/Vessel/README.md',type:'file'}});
    rows.push({id:'/Vessel/设计说明.md',depth:0,item:{name:'设计说明.md',path:'/Vessel/设计说明.md',type:'file'}});
    rows.push(...Array.from({length:500}, (_,i)=>({id:'/Vessel/file-'+i,depth:0,item:{name:'workspace-file-'+i+'.ts',path:'/Vessel/file-'+i,type:'file'}})));
    function Fixture() {
      const layout = useDirectoryTreeLayout();
      const [width] = useDirectoryTreeSidebarWidth();
      const [showSettings, openSettings] = useState(false);
      const [draft, setDraft] = useState({directoryTree: normalizeDirectoryTreeSettings(undefined)});
      const [viewport, setViewport] = useState(null);
      const [selected, select] = useState(deep);
      useEffect(() => { window.fixture = {viewport, deep, select, openSettings, configure: (directoryTree)=>setDirectoryTreeSettings({directoryTree}) }; }, [viewport]);
      return <div style={{display:'flex',gap:24}}>{showSettings && <section className='vessel-settings' style={{width:650,height:590,overflow:'auto',background:'white'}}><DirectoryTreeSettingsPanel value={draft} onChange={setDraft}/><button id='apply-settings' onClick={()=>setDirectoryTreeSettings(draft)}>应用配置</button></section>}<aside style={{width,height:590,display:'flex',flexDirection:'column',background:'white',borderRight:'1px solid #e7e5e4'}}>
        <header style={{height:36,padding:'0 12px',display:'flex',alignItems:'center',fontSize:12,fontWeight:600}}>Vessel</header>
        <ScrollArea viewportRef={setViewport} className='min-h-0 min-w-0 flex-1 pb-2 [&_[data-radix-scroll-area-viewport]>div]:!block'>
          <VirtualTree rows={rows} viewport={viewport} rowHeight={layout.rowHeight} rowGap={layout.gap} showGuides={layout.guides} indent={layout.indent} fullRow selectedId={selected} renderRow={({item,expanded})=><div data-deep={item.path===deep?true:undefined}><FileTreeItem node={item} rootPath='/Vessel' selected={selected===item.path} expanded={!!expanded} onActivate={(event)=>{select(item.path);}}/></div>} />
        </ScrollArea>
      </aside></div>;
    }
    function App(){const [scope,setScope]=useState('workspace');useEffect(()=>{window.setTreeScope=setScope},[]);return <FileIconScope.Provider value={scope}><Fixture/></FileIconScope.Provider>}
    createRoot(document.getElementById('root')).render(<App/>);
  `
  const requireFromVite = require("node:module").createRequire(require.resolve("vite/package.json"))
  requireFromVite("esbuild").buildSync({ stdin: { contents: source, resolveDir: root, loader: "tsx" }, bundle: true, jsx: "automatic", format: "iife", alias: { "@": path.join(root, "src/renderer/src") }, outfile: path.join(directory, "fixture.js"), logLevel: "error" })
  require("postcss")([require("tailwindcss")(path.join(root, "tailwind.config.js"))]).process(fs.readFileSync("src/renderer/src/assets/tailwind.css", "utf8"), { from: path.join(root, "src/renderer/src/assets/tailwind.css") }).then((result) => {
    fs.writeFileSync(path.join(directory, "fixture.css"), fs.readFileSync("src/renderer/src/assets/base.css", "utf8") + result.css + fs.readFileSync("src/renderer/src/pages/settings/appearance.css", "utf8") + fs.readFileSync("src/renderer/src/pages/settings/settings.css", "utf8"))
    fs.writeFileSync(path.join(directory, "index.html"), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="./fixture.css"><style>html{font-size:14px}body{background:#f8f8f8;padding:16px}#root{height:590px;width:280px;border:1px solid #e7e5e4}</style><div id="root"></div><script src="./fixture.js"></script>')
    const env = { ...process.env, VESSEL_TREE_SMOKE: directory }
    delete env.ELECTRON_RUN_AS_NODE
    const child = spawn(require("electron"), [__filename, "--run"], { env, stdio: "inherit" })
    const timer = setTimeout(() => { console.error("FAIL: tree preview timed out"); child.kill("SIGKILL") }, 25000)
    child.on("exit", (code) => { clearTimeout(timer); process.exitCode = code ?? 1 })
  }).catch((error) => { console.error(error); process.exitCode = 1 })
} else {
  const { app, BrowserWindow } = require("electron")
  const assert = require("node:assert/strict")
  app.setPath("userData", path.join(directory, "profile"))
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 330, height: 650, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    await win.loadFile(path.join(directory, "index.html"))
    win.show()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const metrics = await win.webContents.executeJavaScript(`(() => {
      const rows=[...document.querySelectorAll('[role=treeitem]')];
      const labels=rows.map(row=>row.querySelector('[data-tree-label]'));
      const icons=rows.map(row=>row.querySelector('[data-tree-icon]'));
      return {height:rows[0].getBoundingClientRect().height,font:getComputedStyle(labels[0]).fontSize,indent:icons[1].getBoundingClientRect().left-icons[0].getBoundingClientRect().left,aligned:icons[13].getBoundingClientRect().left===icons[14].getBoundingClientRect().left,rows:rows.length,scrollWidth:window.fixture.viewport.scrollWidth,width:window.fixture.viewport.clientWidth,viewportHeight:window.fixture.viewport.clientHeight,horizontal:getComputedStyle(window.fixture.viewport).overflowX};
    })()`)
    assert.equal(metrics.height, 22)
    assert.equal(metrics.font, "13px")
    assert.equal(metrics.indent, 8)
    assert(metrics.aligned, "same-level file icons must align")
    assert(metrics.rows <= Math.ceil(metrics.viewportHeight / 22) * 3 + 2, "tree must remain virtualized with one viewport of buffering: " + JSON.stringify(metrics))
    assert(metrics.scrollWidth <= metrics.width && metrics.horizontal !== "scroll", "tree must fit its viewport without horizontal scrolling")
    const jumped = await win.webContents.executeJavaScript(`(() => { const v=window.fixture.viewport;v.scrollTop=5000;v.dispatchEvent(new Event('scroll'));return [...document.querySelectorAll('[data-tree-label]')].some(label=>label.textContent==='workspace-file-212.ts'); })()`)
    assert(jumped, "a distant vertical scroll must render the newly visible file")
    await win.webContents.executeJavaScript("window.fixture.viewport.scrollTop=0;window.fixture.viewport.dispatchEvent(new Event('scroll'))")
    const truncated = await win.webContents.executeJavaScript(`(() => { const label=document.querySelector('[data-deep] [data-tree-label]'); const s=getComputedStyle(label); return {ellipsis:s.textOverflow,overflow:s.overflowX,truncated:label.scrollWidth>label.clientWidth};})()`)
    assert.deepEqual(truncated, {ellipsis:'ellipsis',overflow:'hidden',truncated:true})
    const screenshot = path.join(directory, "file-tree-preview.png")
    fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG())
    await win.webContents.executeJavaScript("document.querySelector('[data-workspace-tree-row]').click()")
    assert.equal(await win.webContents.executeJavaScript("window.fixture.viewport.scrollLeft"), 0, "clicking a row must not introduce horizontal scrolling")
    console.log("PASS: 22px rows, 13px text, 8px indentation, sibling alignment, filename ellipsis and virtualization")
    console.log("Preview:", screenshot)
    await win.webContents.executeJavaScript(`window.fixture.configure({workspace:{sidebarWidth:300,rowHeight:26,fontSize:15,indent:5,gap:4},resources:{sidebarWidth:360,rowHeight:24,fontSize:12,indent:10,gap:8},guidesWorkspace:false})`)
    await new Promise((resolve) => setTimeout(resolve, 80))
    const custom = await win.webContents.executeJavaScript(`(() => {const r=[...document.querySelectorAll('[role=treeitem]')];return {height:r[0].getBoundingClientRect().height,stride:r[1].getBoundingClientRect().top-r[0].getBoundingClientRect().top,font:getComputedStyle(r[0].querySelector('[data-tree-label]')).fontSize,guides:document.querySelectorAll('[data-tree-guides]').length,width:document.querySelector('aside').getBoundingClientRect().width}})()`)
    assert.deepEqual(custom, {height:26,stride:30,font:'15px',guides:0,width:300})
    await win.webContents.executeJavaScript("window.setTreeScope('resources')")
    await new Promise((resolve) => setTimeout(resolve, 80))
    const resources = await win.webContents.executeJavaScript(`(() => {const r=[...document.querySelectorAll('[role=treeitem]')];return {height:r[0].getBoundingClientRect().height,stride:r[1].getBoundingClientRect().top-r[0].getBoundingClientRect().top,font:getComputedStyle(r[0].querySelector('[data-tree-label]')).fontSize,guides:!!document.querySelector('[data-tree-guides]'),width:document.querySelector('aside').getBoundingClientRect().width}})()`)
    assert.deepEqual(resources, {height:24,stride:32,font:'12px',guides:true,width:360})
    await win.webContents.executeJavaScript("window.fixture.configure({resources:{sidebarWidth:232,indent:40}})")
    await new Promise((resolve) => setTimeout(resolve, 80))
    const narrow = await win.webContents.executeJavaScript(`(() => {const label=document.querySelector('[data-deep] [data-tree-label]');const v=window.fixture.viewport;return {width:label.clientWidth,scrollWidth:v.scrollWidth,viewportWidth:v.clientWidth}})()`)
    assert(narrow.width >= 50 && narrow.scrollWidth <= narrow.viewportWidth, "deep indentation must leave room for filenames without horizontal overflow: "+JSON.stringify(narrow))
    win.setSize(1100, 680)
    await win.webContents.executeJavaScript("window.fixture.openSettings(true)")
    await new Promise((resolve) => setTimeout(resolve, 80))
    await win.webContents.executeJavaScript(`document.querySelector('.settings-section-trigger').click()`)
    await new Promise((resolve) => setTimeout(resolve, 80))
    assert.equal(await win.webContents.executeJavaScript(`!!document.querySelector('input[aria-label="工作区层级缩进"]') && !!document.querySelector('input[aria-label="项目资源库层级缩进"]')`), true)
    const settingsPreview = path.join(directory, "directory-tree-settings-preview.png")
    fs.writeFileSync(settingsPreview, (await win.webContents.capturePage()).toPNG())
    console.log("PASS: independent scope width, font, row height, gap, guides and rendered settings controls")
    console.log("Settings preview:", settingsPreview)
    win.destroy()
    app.quit()
  }).catch((error) => { console.error(error); app.exit(1) })
}
