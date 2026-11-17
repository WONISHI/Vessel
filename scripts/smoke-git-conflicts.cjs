/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")
const { spawn, execFileSync } = require("node:child_process")
const root = path.resolve()
const directory = process.env.VESSEL_GIT_CONFLICT_SMOKE || fs.mkdtempSync(path.join(require("node:os").tmpdir(), "vessel-git-conflicts-"))
if (!process.argv.includes("--run")) {
  const source = `
    import React, {useState,useEffect,useCallback} from 'react';
    import {createRoot} from 'react-dom/client';
    import {GitStashDetails} from '@/pages/git/components/git-stash-details';
    import {GitSidebarNav} from '@/pages/git/components/git-sidebar-nav';
    import {useGitStashView} from '@/pages/git/hooks/use-git-stash-view';
    import {GitConflictFiles} from '@/pages/git/components/git-conflict-files';
    import {GitStagedFiles} from '@/pages/git/components/git-staged-files';
    import {GitUnstagedFiles} from '@/pages/git/components/git-unstaged-files';
    import {DiffViewer} from '@/pages/git/components/diff-viewer';
    import {useGitFileActions} from '@/pages/git/hooks/use-git-file-actions';
    import {useGitFileSelection} from '@/pages/git/hooks/use-git-file-selection';
    import {ResizablePanelGroup,ResizablePanel,ResizableHandle} from '@/components/ui/resizable-panels';
    window.electronAPI={git:{stage:(_,paths)=>window.fixtureAPI.stage(paths),stashPop:(_,index,hash)=>window.fixtureAPI.pop(index,hash),stashApply:(_,index,hash)=>window.fixtureAPI.apply(index,hash),getStashDetail:(_,reference)=>window.fixtureAPI.detail(reference),getStashDiff:(_,hash,name)=>window.fixtureAPI.stashDiff(hash,name)},openProjectInEditor:async()=>{}};
    function App(){
      const [status,setStatus]=useState(null), [stashes,setStashes]=useState(1), [diff,setDiff]=useState('');
      const [stashRecords,setStashRecords]=useState([]),[activeTab,setActiveTab]=useState('status');
      const [selectedFile,setSelectedFile]=useState(null);
      const [selectedStagedPaths,setSelectedStagedPaths]=useState([]),[selectedUnstagedPaths,setSelectedUnstagedPaths]=useState([]),[selectedConflictPaths,setSelectedConflictPaths]=useState([]);
      const [lastStagedClickedIndex,setLastStagedClickedIndex]=useState(-1),[lastUnstagedClickedIndex,setLastUnstagedClickedIndex]=useState(-1),[lastConflictClickedIndex,setLastConflictClickedIndex]=useState(-1);
      const [activeFileSection,setActiveFileSection]=useState('unstaged');
      const refresh=useCallback(async()=>{const state=await window.fixtureAPI.state();setStatus(state.status);setStashes(state.stashes.length);setStashRecords(state.stashes)},[]);
      useEffect(()=>{void refresh();window.smoke={refresh}},[refresh]);
      useEffect(()=>{if(selectedFile)void window.fixtureAPI.diff(selectedFile.path,!!status?.staged.some(f=>f.path===selectedFile.path)).then(result=>setDiff(result.diff));},[selectedFile,status]);
      const repo={repoPath:'/fixture',status,branches:{current:'main',local:[],remote:[]},stashes:stashRecords,refresh,activeTab,setActiveTab,selectedFile,setSelectedFile,selectedStagedPaths,setSelectedStagedPaths,selectedUnstagedPaths,setSelectedUnstagedPaths,selectedConflictPaths,setSelectedConflictPaths,lastStagedClickedIndex,setLastStagedClickedIndex,lastUnstagedClickedIndex,setLastUnstagedClickedIndex,lastConflictClickedIndex,setLastConflictClickedIndex,activeFileSection,setActiveFileSection};
      const actions=useGitFileActions(repo), selection=useGitFileSelection(repo),stashView=useGitStashView(repo),g={...repo,...actions,...selection,...stashView};
      return <div className='vessel-git-page bg-white text-stone-800' style={{height:640,display:'flex',flexDirection:'column'}}>
        <header style={{height:48,padding:12,borderBottom:'1px solid #ddd',display:'flex',justifyContent:'space-between',alignItems:'center'}}><b>Vessel · Git 文件状态</b><button data-pop onClick={()=>actions.handleStashPop()}>弹出贮藏（{stashes}）</button></header>
        <div style={{display:'flex',flex:1,minHeight:0}}><aside style={{width:210,minHeight:0,borderRight:'1px solid #ddd'}}><GitSidebarNav g={g}/></aside><div style={{flex:1,display:'flex',minHeight:0,minWidth:0}}>{activeTab==='stash'?<GitStashDetails g={g}/>:<div style={{display:'flex',flex:1,minHeight:0,minWidth:0}}><div style={{width:520,minHeight:0,borderRight:'1px solid #ddd'}}><ResizablePanelGroup orientation='vertical'>
          {!!status?.conflicts.length&&<><ResizablePanel id='conflicts' defaultSize='30%' minSize='15%' className='flex min-h-0 flex-col'><GitConflictFiles g={g}/></ResizablePanel><ResizableHandle/></>}
          <ResizablePanel id='staged' defaultSize={status?.conflicts.length?'35%':'50%'} className='flex min-h-0 flex-col'><GitStagedFiles g={g}/></ResizablePanel><ResizableHandle/>
          <ResizablePanel id='unstaged' defaultSize={status?.conflicts.length?'35%':'50%'} className='flex min-h-0 flex-col'><GitUnstagedFiles g={g}/></ResizablePanel>
        </ResizablePanelGroup></div><div style={{flex:1,minWidth:0}}><DiffViewer diffText={diff} filePath={selectedFile?.path} isConflict={!!status?.conflicts.some(f=>f.path===selectedFile?.path)} onToggleStage={()=>actions.handleResolveConflicts([selectedFile.path])}/></div></div>}</div></div>
      </div>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  `
  const requireFromVite = require("node:module").createRequire(require.resolve("vite/package.json"))
  requireFromVite("esbuild").buildSync({ stdin: { contents: source, resolveDir: root, loader: "tsx" }, bundle: true, jsx: "automatic", format: "iife", alias: { "@": path.join(root, "src/renderer/src") }, outfile: path.join(directory, "fixture.js"), logLevel: "error" })
  const componentCSS = fs.existsSync(path.join(directory, "fixture.css")) ? fs.readFileSync(path.join(directory, "fixture.css"), "utf8") : ""
  require("postcss")([require("tailwindcss")(path.join(root, "tailwind.config.js"))]).process(fs.readFileSync("src/renderer/src/assets/tailwind.css", "utf8"), { from: path.join(root, "src/renderer/src/assets/tailwind.css") }).then((result) => {
    fs.writeFileSync(path.join(directory, "fixture.css"), result.css + componentCSS + fs.readFileSync("src/renderer/src/pages/git/dark.css", "utf8"))
    fs.writeFileSync(path.join(directory, "index.html"), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="./fixture.css"><style>html{font:14px system-ui}body{background:#eee;padding:16px}</style><div id="root"></div><script src="./fixture.js"></script>')
    fs.writeFileSync(path.join(directory, "preload.cjs"), `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('fixtureAPI',Object.fromEntries(['state','stage','pop','apply','detail','stashDiff','diff','repair'].map(name=>[name,(...args)=>ipcRenderer.invoke('fixture:'+name,...args)])));`)
    const env = { ...process.env, VESSEL_GIT_CONFLICT_SMOKE: directory }
    delete env.ELECTRON_RUN_AS_NODE
    const child = spawn(require("electron"), [__filename, "--run"], { env, stdio: "inherit" })
    const timeout = setTimeout(() => { child.kill("SIGKILL"); console.error("Git conflict preview timed out") }, 30000)
    child.on("exit", (code) => { clearTimeout(timeout); process.exitCode = code ?? 1 })
  }).catch((error) => { console.error(error); process.exitCode = 1 })
} else {
  const { app, BrowserWindow, ipcMain } = require("electron")
  const assert = require("node:assert/strict")
  const ts = require("typescript")
  app.setPath("userData", path.join(directory, "profile"))
  const repo = path.join(directory, "repo")
  fs.mkdirSync(repo)
  const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: ["ignore", "pipe", "pipe"] })
  git("init", "--quiet", "-b", "main"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.test"); git("config", "commit.gpgSign", "false"); git("config", "core.hooksPath", "/dev/null")
  const file = "components/冲突文件.ts"
  fs.mkdirSync(path.join(repo, "components"))
  fs.writeFileSync(path.join(repo, file), "export const value = 'base';\n")
  fs.writeFileSync(path.join(repo, "safe.md"), "base\n")
  git("add", "."); git("commit", "--quiet", "-m", "base")
  fs.writeFileSync(path.join(repo, file), "export const value = 'stashed';\n")
  fs.writeFileSync(path.join(repo, "safe.md"), "restored clean change\n")
  fs.writeFileSync(path.join(repo, "new-untracked.md"), "saved untracked content\n")
  git("stash", "push", "-u", "-m", "conflict fixture")
  fs.writeFileSync(path.join(repo, file), "export const value = 'current';\n")
  git("add", "."); git("commit", "--quiet", "-m", "current")
  require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  const { gitService } = require(path.join(root, "src/main/modules/git/git-service.ts"))
  app.whenReady().then(async () => {
    ipcMain.handle("fixture:state", async () => ({ status: await gitService.getStatus(repo), stashes: await gitService.getStashes(repo) }))
    ipcMain.handle("fixture:pop", (_, index, hash) => gitService.stashPop(repo, index, hash))
    ipcMain.handle("fixture:apply", (_, index, hash) => gitService.stashApply(repo, index, hash))
    ipcMain.handle("fixture:detail", (_, reference) => gitService.getStashDetail(repo, reference))
    ipcMain.handle("fixture:stashDiff", (_, hash, name) => gitService.getStashDiff(repo, hash, name))
    ipcMain.handle("fixture:stage", (_, files) => gitService.stage(repo, files))
    ipcMain.handle("fixture:diff", (_, name, staged) => gitService.getDiff(repo, name, staged))
    ipcMain.handle("fixture:repair", () => fs.writeFileSync(path.join(repo, file), "export const value = 'resolved';\n"))
    const window = new BrowserWindow({ width: 1470, height: 710, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(directory, "preload.cjs") } })
    await window.loadFile(path.join(directory, "index.html")); window.show()
    const wait = async (expression) => { for (let i=0;i<80;i++) { if(await window.webContents.executeJavaScript(expression)) return; await new Promise(resolve=>setTimeout(resolve,60)) } throw new Error("Timed out: "+expression) }
    await wait("!!document.querySelector('[data-pop]')")
    await wait("!!document.querySelector('[data-git-stash-row]')")
    await window.webContents.executeJavaScript("document.querySelector('[data-git-stash-row]').click()")
    await wait("document.body.innerText.includes('new-untracked.md') && document.body.innerText.includes('stashed')")
    await window.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(button=>button.textContent.includes('new-untracked.md')).click()")
    await wait("document.body.innerText.includes('saved untracked content')")
    const stashPreview = path.join(directory, "git-stash-preview.png")
    fs.writeFileSync(stashPreview, (await window.webContents.capturePage()).toPNG())
    await window.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(button=>button.textContent==='弹出贮藏').click()")
    await wait("!!document.querySelector('[data-git-conflict-header]') && document.body.innerText.includes('<<<<<<<')")
    assert.equal((await gitService.getStashes(repo)).length, 1)
    assert.equal((await gitService.getStatus(repo)).conflicts.length, 1)
    const screenshot = path.join(directory, "git-conflicts-preview.png")
    fs.writeFileSync(screenshot, (await window.webContents.capturePage()).toPNG())
    await window.webContents.executeJavaScript("window.fixtureAPI.repair().then(()=>window.smoke.refresh())")
    await window.webContents.executeJavaScript("[...document.querySelectorAll('[data-git-conflict-header] button')].find(button=>button.textContent.includes('暂存所选')).click()")
    await wait("!document.querySelector('[data-git-conflict-header]') && [...document.querySelectorAll('[data-git-file-selected=true]')].some(row=>row.textContent.includes('冲突文件.ts'))")
    const status = await gitService.getStatus(repo)
    assert.equal(status.conflicts.length, 0)
    assert(status.staged.some(entry => entry.path === file))
    assert((await gitService.getDiff(repo, file, true)).diff.includes("resolved"))
    git("add", "-A"); git("commit", "--quiet", "-m", "resolved fixture")
    git("reset", "--hard", "HEAD~2")
    await window.webContents.executeJavaScript("window.smoke.refresh()")
    await window.webContents.executeJavaScript("document.querySelector('[data-pop]').click()")
    await wait("document.querySelector('[data-pop]').textContent.includes('（0）')")
    assert.equal((await gitService.getStashes(repo)).length, 0)
    console.log("PASS: saved tracked/untracked preview, pop-with-conflicts retains stash, repaired selection stages, clean pop removes record")
    console.log("Stash preview:", stashPreview)
    console.log("Preview:", screenshot)
    window.destroy(); app.quit()
  }).catch(error => { console.error(error); app.exit(1) })
}
