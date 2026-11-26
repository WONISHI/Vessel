import { afterEach, expect, it, vi } from "vitest"
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EventEmitter } from "node:events"
const mock=vi.hoisted(()=>({root:"",handlers:new Map<string,(...args:any[])=>any>(),fetch:vi.fn(),proxy:vi.fn(),systemEnable:vi.fn(),systemRestore:vi.fn()}))
vi.mock("electron",()=>({app:{getPath:()=>mock.root,once:vi.fn(),on:vi.fn(),quit:vi.fn()},net:{fetch:mock.fetch},safeStorage:{isEncryptionAvailable:()=>false}}))
vi.mock("@main/browser/system-proxy",()=>({SystemProxy:class { enable=mock.systemEnable;restore=mock.systemRestore }}))
vi.mock("@main/settings/settings",()=>({generalSettings:()=>({proxyEnabled:true}),settingsEvents:{on:vi.fn()}}))
vi.mock("@main/browser/browser-session-proxy",()=>({setBrowserSessionProxy:mock.proxy,closeBrowserSessionConnections:vi.fn()}))
vi.mock("node:child_process",()=>({spawn:()=>Object.assign(new EventEmitter(),{kill:vi.fn()}),execFile:vi.fn()}))
vi.mock("node:net",()=>({createServer:()=>({on:vi.fn(),listen:(_p:any,_h:any,callback:()=>void)=>callback(),address:()=>({port:2345}),close:(callback:()=>void)=>callback()})}))
afterEach(async()=>{vi.unstubAllGlobals();vi.restoreAllMocks();if(mock.root)await rm(mock.root,{recursive:true,force:true})})
it("reads real controller totals, metadata and mode changes, persists totals and rejects unavailable TUN",async()=>{
 mock.systemEnable.mockResolvedValue(undefined)
 mock.systemRestore.mockResolvedValue(undefined)
 mock.root=await mkdtemp(join(tmpdir(),"vessel-runtime-"))
 const directory=join(mock.root,"browser-proxy")
 await mkdir(directory)
 const release=(await import("../../src/main/mihomo-release.json")).default
 await writeFile(join(directory,`mihomo-${release.version}`),"test core")
 mock.fetch.mockImplementation(async()=>new Response("proxies:\n  - name: Node A\n    type: http\n    server: localhost\n    port: 9998\n",{headers:{"subscription-userinfo":"upload=30; download=70; total=1000; expire=1800000000"}}))
 let up=0,down=0,time=1000,fail=false
 vi.spyOn(Date,"now").mockImplementation(()=>time)
 const config={mode:"rule",tun:{enable:false}}
 const controller=vi.fn(async(url:string,options:any)=>{
  const path=new URL(url).pathname
  if(path==="/connections")return Response.json({uploadTotal:up,downloadTotal:down})
  if(path==="/proxies/Vessel")return Response.json({all:["Node A"],now:"Node A"})
  if(options.method==="PATCH"){
   const data=JSON.parse(options.body)
   if(fail&&data.mode==="direct")return new Response("failed",{status:400})
   Object.assign(config,data);return new Response(null,{status:204})
  }
  if(path==="/configs")return Response.json(config)
  return new Response(null,{status:204})
 })
 vi.stubGlobal("fetch",controller)
 const {registerBrowserProxy}=await import("@main/browser/browser-proxy")
 registerBrowserProxy({ipc:{handle:(name:string,fn:any)=>mock.handlers.set(name,fn)}} as any)
 const call=(name:string,...args:any[])=>mock.handlers.get(`browser:proxy:${name}`)!({},...args)
 const profile=await call("profile-save",{name:"Test",url:"https://example.test/sub"})
 const connected=await call("profile-connect",profile.id)
 expect(connected.connected).toBe(true)
 expect(connected.runtime.scope).toBe("system")
 expect(mock.systemEnable).toHaveBeenCalledWith(2345)
 await call("runtime",{scope:"browser"})
 expect((await call("status")).runtime.scope).toBe("browser")
 expect(mock.systemRestore).toHaveBeenCalled()
 await expect(call("runtime",{tun:true})).rejects.toThrow()
 mock.systemEnable.mockRejectedValueOnce(new Error("系统代理未能生效"))
 await expect(call("runtime",{scope:"system"})).rejects.toThrow("系统代理未能生效")
 expect((await call("status")).runtime.scope).toBe("browser")
 expect((await call("profiles"))[0].info).toMatchObject({uploaded:30,downloaded:70,total:1000})
 time=2000;up=100;down=400
 const sampled=await call("status")
 expect(sampled.runtime.traffic).toMatchObject({uploadRate:100,downloadRate:400,totalDownloaded:400})
 const global=await call("runtime",{mode:"global"})
 expect(global.runtime.mode).toBe("global")
 expect(controller).toHaveBeenCalledWith(expect.stringContaining("/proxies/GLOBAL"),expect.objectContaining({method:"PUT",body:JSON.stringify({name:"Vessel"})}))
 fail=true
 await expect(call("runtime",{mode:"direct"})).rejects.toThrow()
 expect((await call("status")).runtime.mode).toBe("global")
 if(!(await call("status")).runtime.tunAvailable)await expect(call("runtime",{tun:true})).rejects.toThrow("管理员")
 await call("disconnect")
 expect(JSON.parse(await readFile(join(directory,"traffic.json"),"utf8"))).toEqual({upload:100,download:400})
 expect(JSON.parse(await readFile(join(directory,"runtime.json"),"utf8"))).toEqual({mode:"global",scope:"browser"})
})
