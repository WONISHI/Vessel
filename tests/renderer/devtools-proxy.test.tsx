import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import ProxyTool from "@/pages/debug/proxy"
import { useProxyEnabled } from "@/pages/debug/proxy/use-proxy-enabled"
import { getDevToolGroups } from "@/pages/debug/components/index-shared"
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })
it("adds the developer tool only after enabling proxy and removes it after disabling", async () => {
 let enabled = false
 window.electronAPI = {getSettings:vi.fn(async()=>({proxyEnabled:enabled}))} as any
 const hook = renderHook(useProxyEnabled)
 const ids = () => getDevToolGroups(hook.result.current).flatMap(group=>group.items.map(item=>item.id))
 expect(ids()).not.toContain("proxy")
 enabled = true
 act(()=>window.dispatchEvent(new Event("vessel:settings-saved")))
 await waitFor(()=>expect(ids()).toContain("proxy"))
 expect(getDevToolGroups(true).find(group=>group.items.some(item=>item.id==="proxy"))?.title).toBe("网络")
 enabled = false
 act(()=>window.dispatchEvent(new Event("vessel:settings-saved")))
 await waitFor(()=>expect(ids()).not.toContain("proxy"))
 expect(getDevToolGroups(false).some(group=>group.title==="网络")).toBe(false)
})
it("adds named subscriptions, connects the selected profile and preserves the others", async () => {
 vi.stubGlobal("ResizeObserver",class{observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn()})
 let items = [{id:"old",name:"原有订阅",url:"https://old.example/sub?token=secret"}]
 const disconnected = {connected:false,nodes:["Node A","Node B"],hasSubscription:true,selected:""}
 const connected = {...disconnected,connected:true,selected:"Node A",subscriptionId:"new"}
 const connect = vi.fn().mockResolvedValue(connected)
 const save = vi.fn(async input => { const item={...input,id:"new"};items=[...items,item];return item })
 const select = vi.fn().mockResolvedValue({...connected,selected:"Node B"})
 const disconnect = vi.fn().mockResolvedValue(disconnected)
 window.electronAPI = {getSettings:vi.fn().mockResolvedValue({proxyEnabled:true}),browserProxyStatus:vi.fn().mockResolvedValue(disconnected),listBrowserProxySubscriptions:vi.fn(async()=>items),saveBrowserProxyProfile:save,connectBrowserProxyProfile:connect,selectBrowserProxy:select,disconnectBrowserProxy:disconnect} as any
 render(<ProxyTool/>)
 await screen.findByRole("button",{name:"选择订阅 原有订阅"})
 expect(screen.queryByLabelText("Clash 订阅链接")).toBeNull()
 expect(document.body.textContent).not.toContain("token=secret")
 fireEvent.click(screen.getByRole("button",{name:"新增订阅"}))
 fireEvent.change(screen.getByLabelText("订阅名称"),{target:{value:"工作订阅"}})
 fireEvent.change(screen.getByLabelText("订阅地址"),{target:{value:"https://work.example/sub"}})
 fireEvent.click(screen.getByRole("button",{name:"保存订阅"}))
 await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull())
 expect(save).toHaveBeenCalledWith({id:undefined,name:"工作订阅",url:"https://work.example/sub"})
 expect(screen.getByRole("button",{name:"选择订阅 原有订阅"})).toBeTruthy()
 expect(screen.getByRole("button",{name:"选择订阅 工作订阅"}).getAttribute("aria-pressed")).toBe("true")
 fireEvent.click(screen.getByRole("button",{name:"连接",exact:true}))
 await waitFor(()=>expect(connect).toHaveBeenCalledWith("new"))
 await screen.findByRole("button",{name:"断开",exact:true})
 fireEvent.change(screen.getByLabelText("搜索节点"),{target:{value:"Node B"}})
 fireEvent.click(screen.getByRole("button",{name:"Node B",exact:true}))
 await waitFor(()=>expect(select).toHaveBeenCalledWith("Node B"))
 fireEvent.click(screen.getByRole("button",{name:"断开",exact:true}))
 await waitFor(()=>expect(disconnect).toHaveBeenCalledOnce())
 fireEvent.click(screen.getByRole("button",{name:"选择订阅 原有订阅"}))
 expect(screen.getByRole("button",{name:"选择订阅 原有订阅"}).getAttribute("aria-pressed")).toBe("true")
})
it("keeps subscription input open and displays validation errors", async () => {
 vi.stubGlobal("ResizeObserver",class{observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn()})
 window.electronAPI = {getSettings:vi.fn().mockResolvedValue({proxyEnabled:true}),browserProxyStatus:vi.fn().mockResolvedValue({connected:false,nodes:[]}),listBrowserProxySubscriptions:vi.fn().mockResolvedValue([]),saveBrowserProxyProfile:vi.fn().mockRejectedValue(new Error("请输入 HTTP 或 HTTPS 订阅地址"))} as any
 render(<ProxyTool/>)
 fireEvent.click(await screen.findByRole("button",{name:"新增订阅"}))
 fireEvent.change(screen.getByLabelText("订阅名称"),{target:{value:"测试"}})
 fireEvent.change(screen.getByLabelText("订阅地址"),{target:{value:"invalid"}})
 fireEvent.click(screen.getByRole("button",{name:"保存订阅"}))
 expect(await screen.findByRole("alert")).toHaveProperty("textContent","请输入 HTTP 或 HTTPS 订阅地址")
 expect(screen.getByLabelText("订阅名称")).toHaveProperty("value","测试")
})

it("switches node previews by subscription and ignores a stale response without changing the active connection", async () => {
 vi.stubGlobal("ResizeObserver",class{observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn()})
 localStorage.removeItem("vessel:proxy-subscription")
 let finishFirst!: (nodes: string[]) => void
 const preview = vi.fn(id => id === "a" ? new Promise<string[]>(resolve => { finishFirst = resolve }) : Promise.resolve(["B node"]))
 const select = vi.fn(), connect = vi.fn()
 window.electronAPI = {getSettings:vi.fn().mockResolvedValue({proxyEnabled:true}),browserProxyStatus:vi.fn().mockResolvedValue({connected:true,nodes:["Other connected node"],subscriptionId:"other",selected:"Other connected node"}),listBrowserProxySubscriptions:vi.fn().mockResolvedValue([{id:"a",name:"A",url:"https://a.test/sub"},{id:"b",name:"B",url:"https://b.test/sub"}]),getBrowserProxyProfileNodes:preview,selectBrowserProxy:select,connectBrowserProxyProfile:connect} as any
 render(<ProxyTool/> )
 await waitFor(()=>expect(preview).toHaveBeenCalledWith("a"))
 fireEvent.click(screen.getByRole("button",{name:"选择订阅 B"}))
 const node = await screen.findByRole("button",{name:"B node"})
 expect((node as HTMLButtonElement).disabled).toBe(true)
 expect(screen.queryByText("Other connected node")).toBeNull()
 await act(async()=>finishFirst(["Stale A node"]))
 expect(screen.queryByText("Stale A node")).toBeNull()
 expect(screen.getByText("B node")).toBeTruthy()
 expect(select).not.toHaveBeenCalled()
 expect(connect).not.toHaveBeenCalled()
})
