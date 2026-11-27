import { formatTraffic } from "./traffic-format"
import { useId } from "react"
import { ArrowDown, ArrowUp, Gauge, RefreshCw, SlidersHorizontal } from "lucide-react"
import { Area, AreaChart, XAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { BrowserProxyStatus, BrowserProxySubscription, BrowserProxyMode, BrowserProxyScope } from "@vessel/type"

export function ProxyTelemetry({ status, subscription, busy, refreshing, onRefresh, onConfigure }: {
  status?: BrowserProxyStatus; subscription?: BrowserProxySubscription; busy: boolean; refreshing: boolean
  onRefresh: () => void; onConfigure: (input: { mode?: BrowserProxyMode; scope?: BrowserProxyScope; tun?: boolean }) => void
}) {
  const id = useId().replace(/:/g, "")
  const runtime = status?.runtime, traffic = runtime?.traffic, info = subscription?.info
  const used = info?.uploaded !== undefined && info.downloaded !== undefined ? info.uploaded + info.downloaded : undefined
  const remaining = used !== undefined && info?.total ? Math.max(0, info.total - used) : undefined
  const lowTraffic = remaining !== undefined && Number.isFinite(remaining) && remaining <= 5 * 1024 ** 3
  const percent = used !== undefined && info?.total ? Math.min(100, used / info.total * 100) : undefined
  const expiry = info?.expiresAt ? new Date(info.expiresAt) : undefined
  const today = new Date()
  const expiresSoon = expiry && Number.isFinite(expiry.getTime()) &&
    Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) < 15 * 86400000
  return <div className="dev-proxy-telemetry">
    <section className="dev-proxy-panel" aria-label="网络速度">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Gauge size={16} />网络速度</h3>
        <div className="ml-auto flex gap-3 text-xs tabular-nums"><span className="flex items-center gap-1 text-blue-500"><ArrowUp size={13}/>{formatTraffic(traffic?.uploadRate)}/s</span><span className="flex items-center gap-1 text-green-600"><ArrowDown size={13}/>{formatTraffic(traffic?.downloadRate)}/s</span></div>
      </div>
      <ChartContainer className="dev-proxy-chart" config={{upload:{label:"上传",color:"#3b82f6"},download:{label:"下载",color:"#16a34a"}}} aria-label="上传下载速率曲线">
        <AreaChart data={traffic?.history || []} margin={{left:0,right:0,top:12,bottom:0}} accessibilityLayer>
          <defs><linearGradient id={`proxy-down-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a34a" stopOpacity={0.3}/><stop offset="100%" stopColor="#16a34a" stopOpacity={0.02}/></linearGradient><linearGradient id={`proxy-up-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01}/></linearGradient></defs>
          <XAxis dataKey="time" hide/>
          <ChartTooltip content={<ChartTooltipContent labelFormatter={value => new Date(Number(value)).toLocaleTimeString()} formatter={(value,name)=><span>{name === "upload" ? "上传" : "下载"} {formatTraffic(Number(value))}/s</span>}/>} />
          <Area type="monotone" dataKey="upload" stroke="#3b82f6" fill={`url(#proxy-up-${id})`} strokeWidth={2} isAnimationActive={false} />
          <Area type="monotone" dataKey="download" stroke="#16a34a" fill={`url(#proxy-down-${id})`} strokeWidth={2} isAnimationActive={false} />
        </AreaChart>
      </ChartContainer>
      <p className="mt-2 text-[11px] text-muted-foreground">{runtime?.trafficError || (status?.connected ? "当前代理连接的实时速率" : "连接订阅后显示实时速率")}</p>
    </section>
    <section className="dev-proxy-panel" aria-label="流量统计">
      <h3 className="mb-3 text-sm font-semibold">流量统计</h3>
      <dl className="dev-proxy-stat-grid">
        <div><dt>本次上传</dt><dd>{formatTraffic(traffic?.uploaded)}</dd></div><div><dt>本次下载</dt><dd>{formatTraffic(traffic?.downloaded)}</dd></div>
        <div><dt>累计上传</dt><dd>{formatTraffic(traffic?.totalUploaded)}</dd></div><div><dt>累计下载</dt><dd>{formatTraffic(traffic?.totalDownloaded)}</dd></div>
      </dl>
      <p className="mt-3 text-[11px] text-muted-foreground">累计为本机代理流量记录，与服务商计费统计可能不同。</p>
    </section>
    <section className="dev-proxy-panel" aria-label="订阅用量">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">订阅信息</h3><Button variant="ghost" size="icon" className="size-7" aria-label="刷新订阅信息" disabled={!subscription || busy || refreshing} onClick={onRefresh}><RefreshCw size={14} className={refreshing ? "animate-spin" : undefined}/></Button></div>
      <p className="mb-3 truncate text-xs text-muted-foreground">{subscription?.name || "请选择订阅"}</p>
      <dl className="dev-proxy-stat-grid"><div><dt>已用流量</dt><dd>{formatTraffic(used)}</dd></div><div><dt>总流量</dt><dd>{formatTraffic(info?.total)}</dd></div><div><dt>剩余流量</dt><dd className={lowTraffic ? "!text-red-600 dark:!text-red-400" : undefined}>{formatTraffic(remaining)}</dd></div><div><dt>到期时间</dt><dd className={`!text-xs${expiresSoon ? " !text-red-600 dark:!text-red-400" : ""}`}>{info?.expiresAt === 0 ? "不限期" : info?.expiresAt ? new Date(info.expiresAt).toLocaleDateString() : "未提供"}</dd></div></dl>
      {percent !== undefined && <Progress className="mt-3 h-1.5" value={percent} aria-label="订阅流量使用比例"/>}
      <p className="mt-3 text-[11px] text-muted-foreground">{info ? `更新于 ${new Date(info.updatedAt).toLocaleString()}；缺失项表示服务商未提供。` : "连接或刷新后读取服务商提供的额度与到期时间。"}</p>
    </section>
    <section className="dev-proxy-panel" aria-label="代理配置">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal size={15}/>代理配置</h3>
      <label className="mb-3 flex items-center justify-between gap-3 text-xs">代理范围<Select value={runtime?.scope || "system"} disabled={busy || !runtime} onValueChange={value=>{if (value === "system" || value === "browser") onConfigure({scope:value})}}><SelectTrigger aria-label="代理范围" className="h-8 w-40 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="system">代理系统</SelectItem><SelectItem value="browser">代理 Vessel 浏览器</SelectItem></SelectContent></Select></label>
      <p className="mb-4 text-[11px] text-muted-foreground">{runtime?.scope === "browser" ? "仅 Vessel 内置浏览器使用代理，不修改系统代理。" : "默认设置系统 HTTP/HTTPS 代理，作用于遵循系统代理的应用；断开时恢复原设置。"}</p>
      <label className="mb-3 flex items-center justify-between gap-3 text-xs">出站模式<Select value={runtime?.mode || "rule"} disabled={busy || !runtime} onValueChange={value=>{if (["rule","global","direct"].includes(value)) onConfigure({mode:value as BrowserProxyMode})}}><SelectTrigger aria-label="出站模式" className="h-8 w-28 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="rule">规则</SelectItem><SelectItem value="global">全局</SelectItem><SelectItem value="direct">直连</SelectItem></SelectContent></Select></label>
      <p className="mb-4 text-[11px] text-muted-foreground">规则遵循当前核心规则；全局使用所选节点，直连不经过代理节点。</p>
      <div className="flex items-center justify-between gap-3 text-xs"><span>虚拟网卡 TUN</span><Switch aria-label="虚拟网卡 TUN" checked={!!runtime?.tun} disabled={busy || !status?.connected || !runtime?.tunAvailable} onCheckedChange={value=>onConfigure({tun:value})}/></div>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{runtime?.tunReason || "TUN 会接管系统流量，需要管理员权限，仅对本次连接生效。"}</p>
    </section>
  </div>
}
