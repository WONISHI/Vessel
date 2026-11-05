import { mkdtemp, mkdir, writeFile, rm, stat } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ root:"", id:"a".repeat(32), prepare:vi.fn(), choice:vi.fn(), load:vi.fn(), ses:{} as any }))
vi.mock("@main/browser/browser-identity",()=>({applyBrowserIdentity:vi.fn()}))
vi.mock("@main/browser/browser-site-compatibility",()=>({registerBrowserSiteCompatibility:vi.fn()}))
vi.mock("@main/browser/extensions/extension-store",async()=>({...await vi.importActual<any>("@main/browser/extensions/extension-store"), prepareStoreExtension:m.prepare}))
vi.mock("electron",()=>{
  m.ses={extensions:{loadExtension:m.load,removeExtension:vi.fn()},fetch:vi.fn()}
  return {app:{getPath:()=>m.root,getAppPath:()=>join(m.root,"missing"),on:vi.fn(),removeListener:vi.fn()},session:{fromPartition:()=>m.ses},webContents:{getAllWebContents:()=>[]},BrowserWindow:{fromWebContents:()=>({})},dialog:{showMessageBox:m.choice}}
})
it("仅商店主框架可安装；取消不加载，确认才加载并通知 Sheet，重复安装不重复下载",async()=>{
  m.root=await mkdtemp(join(tmpdir(),"vessel-store-lifecycle-"))
  const messages:any[]=[];const handlers=new Map<string,Function>();let attached:Function=()=>{}
  const host={on:(name:string,fn:Function)=>{if(name==="did-attach-webview")attached=fn},once:vi.fn(),isDestroyed:()=>false,send:(_name:string,status:any)=>messages.push(status),ipc:{handle:(name:string,fn:Function)=>handlers.set(name,fn)}}
  const {registerBrowserExtensions}=await import("@main/browser/browser-extensions")
  registerBrowserExtensions(host as any)
  let install:Function=()=>{};let url=`https://evil.test/detail/${m.id}`;const frame={}
  const guest={getURL:()=>url,isDestroyed:()=>false,mainFrame:frame,session:m.ses,ipc:{on:(_name:string,fn:Function)=>{install=fn}}}
  attached({},guest)
  let path=""
  m.prepare.mockImplementation(async()=>{
    path=join(m.root,"browser-extension-packages",`import-${m.prepare.mock.calls.length}`)
    await mkdir(path,{recursive:true})
    await writeFile(join(path,"manifest.json"),JSON.stringify({manifest_version:3,name:"Store Test",version:"1.0",permissions:["storage"]}))
    return {directory:path,path,digest:"test",name:"Store Test",version:"1.0",permissions:["storage"],optional:[]}
  })
  m.choice.mockResolvedValue({response:0})
  m.load.mockResolvedValue({id:m.id,name:"Store Test",version:"1.0"})
  try {
    await install({senderFrame:frame});expect(m.prepare).not.toHaveBeenCalled()
    url=`https://chromewebstore.google.com/detail/test/${m.id}`
    await install({senderFrame:{}});expect(m.prepare).not.toHaveBeenCalled()
    await install({senderFrame:frame})
    expect(m.load).not.toHaveBeenCalled()
    expect(m.choice).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({detail:expect.stringContaining("storage"),defaultId:0}))
    expect(messages.at(-1).phase).toBe("cancelled")
    await expect(stat(path)).rejects.toThrow()
    m.choice.mockResolvedValue({response:1})
    await install({senderFrame:frame})
    expect(m.load).toHaveBeenCalledTimes(1)
    expect(messages.at(-1).phase).toBe("complete")
    const records=await handlers.get("browser:extensions:list")!()
    expect(records).toEqual(expect.arrayContaining([expect.objectContaining({storeId:m.id,enabled:true,extensionId:m.id})]))
    await install({senderFrame:frame})
    expect(m.prepare).toHaveBeenCalledTimes(2)
    expect(messages.at(-1).message).toContain("已安装")
  } finally { await rm(m.root,{recursive:true,force:true}) }
})
