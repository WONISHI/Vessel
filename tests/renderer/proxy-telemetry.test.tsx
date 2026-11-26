import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ProxyTelemetry } from "@/pages/debug/proxy/telemetry"
import { formatTraffic } from "@/pages/debug/proxy/traffic-format"
import type { BrowserProxyStatus } from "@vessel/type"
vi.mock("@/components/ui/chart",()=>({ChartContainer:({children}:any)=><div>{children}</div>,ChartTooltip:()=>null,ChartTooltipContent:()=>null}))
vi.mock("recharts",()=>({AreaChart:()=> <div aria-label="速率图表"/>,Area:()=>null,XAxis:()=>null}))
afterEach(cleanup)
it("formats unknown, zero and byte units consistently",()=>{
 expect(formatTraffic()).toBe("—")
 expect(formatTraffic(0)).toBe("0 B")
 expect(formatTraffic(1536)).toBe("1.5 KB")
 expect(formatTraffic(1024**3)).toBe("1.0 GB")
})
it("separates provider quotas from local counters and explains unavailable TUN",()=>{
 const refresh=vi.fn(),configure=vi.fn()
 const status={connected:true,runtime:{mode:"rule",tun:false,tunAvailable:false,tunReason:"需要管理员权限",traffic:{uploadRate:8500,downloadRate:2300,uploaded:2048,downloaded:4096,totalUploaded:8192,totalDownloaded:16384,history:[]}}} as unknown as BrowserProxyStatus
 render(<ProxyTelemetry status={status} subscription={{id:"one",name:"Test",url:"https://example.test",info:{uploaded:100,downloaded:200,total:1000,updatedAt:0}}} busy={false} refreshing={false} onRefresh={refresh} onConfigure={configure}/>)
 const quota=within(screen.getByRole("region",{name:"订阅用量"}))
 expect(quota.getByText("300 B")).toBeTruthy()
 expect(quota.getByText("700 B")).toBeTruthy()
 expect(quota.getByText("1000 B")).toBeTruthy()
 expect(quota.getByText("未提供")).toBeTruthy()
 expect(screen.getByText("2.0 KB")).toBeTruthy()
 expect(screen.getByRole("switch",{name:"虚拟网卡 TUN"}).hasAttribute("disabled")).toBe(true)
 expect(screen.getByText("需要管理员权限")).toBeTruthy()
 expect(screen.getByRole("combobox",{name:"代理范围"}).textContent).toContain("代理系统")
 fireEvent.click(screen.getByRole("button",{name:"刷新订阅信息"}))
 expect(refresh).toHaveBeenCalledOnce()
})
it("does not display missing provider quotas as zero or unlimited",()=>{
 render(<ProxyTelemetry status={{connected:false} as BrowserProxyStatus} subscription={{id:"one",name:"Test",url:"https://example.test",info:{updatedAt:0}}} busy={false} refreshing={false} onRefresh={vi.fn()} onConfigure={vi.fn()}/>)
 const region=within(screen.getByRole("region",{name:"订阅用量"}))
 expect(region.queryByText("0 B")).toBeNull()
 expect(region.queryByText("不限期")).toBeNull()
 expect(region.getAllByText("—")).toHaveLength(3)
})
