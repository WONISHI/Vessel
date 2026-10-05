import { useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { Waypoints, Shield, Link, Eye, EyeOff, Unlink, MapPin, Search, Info, RefreshCw } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { BrowserProxyStatus } from "../../../../shared/browser-proxy"
export function BrowserProxy() {
  const { pathname } = useLocation()
  const [search, setSearch] = useState("")
  const [reveal, setReveal] = useState(false)
  const [open, setOpen] = useState(false)
  const [url, setURL] = useState("")
  const [status, setStatus] = useState<BrowserProxyStatus>()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  if (open && pathname !== "/browser") setOpen(false)
  useEffect(() => {
    let alive = true
    const refresh = () => {
      void window.electronAPI
        .browserProxyStatus()
        .then((value) => {
          if (alive) setStatus(value)
        })
        .catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 1000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])
  useEffect(() => {
    void window.electronAPI
      .browserProxySubscription()
      .then(setURL)
      .catch(() => {})
  }, [])
  async function run(action: () => Promise<BrowserProxyStatus>) {
    setPending(true)
    setError("")
    try {
      setStatus(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败")
    } finally {
      setPending(false)
    }
  }
  const nodes = (status?.nodes || []).filter((node) => node.toLowerCase().includes(search.toLowerCase()))
  const disabled = pending || status?.busy
  return (
    <Sheet
      modal={false}
      open={open}
      onOpenChange={setOpen}
    >
      <SheetTrigger asChild>
        <button
          title="Clash 浏览器代理"
          aria-label="Clash 浏览器代理"
          className={`p-1 ${status?.connected ? "text-green-600" : ""}`}
        >
          <Waypoints className="size-4" />
        </button>
      </SheetTrigger>
      <SheetContent
        showOverlay={false}
        aria-describedby={undefined}
        className="flex w-[360px] max-w-full flex-col gap-0 p-0 sm:max-w-[360px] [&>button]:right-5 [&>button]:top-6 [&>button]:text-stone-400"
      >
        <SheetHeader className="shrink-0 px-4 pb-3 pt-4 text-left">
          <SheetTitle className="flex items-center gap-3 pr-5 text-base font-bold text-stone-900">
            <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-green-700 text-white">
              <Shield className="size-5" />
            </span>
            代理
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4 pb-3">
            <label
              htmlFor="clash-subscription"
              className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500"
            >
              <Link size={14} />
              订阅链接
            </label>
            <div className="relative">
              <Input
                id="clash-subscription"
                aria-label="Clash 订阅链接"
                type={reveal ? "text" : "password"}
                placeholder={status?.hasSubscription ? "已保存订阅，可直接连接或粘贴新链接" : "https://…"}
                value={url}
                onChange={(e) => {
                  setURL(e.target.value)
                  void window.electronAPI.saveBrowserProxySubscription(e.target.value).catch((error) => setError(String(error)))
                }}
                className="h-10 rounded-lg border-stone-200 bg-stone-50 pr-10 focus-visible:ring-green-600"
              />
              <button
                aria-label={reveal ? "隐藏订阅链接" : "显示订阅链接"}
                onClick={() => setReveal(!reveal)}
                className="absolute right-3 top-3 text-stone-400"
              >
                {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="mt-3">
              <Button
                disabled={disabled}
                onClick={() => void run(() => (status?.connected ? window.electronAPI.disconnectBrowserProxy() : window.electronAPI.connectBrowserProxy(url || undefined)))}
                className={`h-8 px-4 text-white ${status?.connected ? "bg-stone-600 hover:bg-stone-700" : "bg-green-600 hover:bg-green-700"}`}
              >
                {status?.connected ? <Unlink size={14} /> : <Link size={14} />}
                {status?.connected ? "断开" : "连接"}
              </Button>
            </div>
            <p
              role="status"
              className="mt-4 flex items-center gap-2 text-xs leading-5 text-stone-500"
            >
              <span className={`size-2 shrink-0 rounded-full ${status?.connected ? "bg-green-600 ring-4 ring-green-100" : "bg-stone-300"}`} />
              {status?.stage || "未连接"}
            </p>
            {(error || status?.error) && (
              <p
                role="alert"
                className="mt-2 break-words text-xs text-red-600"
              >
                {error || status?.error}
              </p>
            )}
            <div className="mb-4 mt-3 border-t border-stone-100" />
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-700">
                <MapPin
                  size={16}
                  className="text-green-600"
                />
                节点选择
              </h3>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-400">{status?.nodes.length || 0} 个节点</span>
              <div className="relative ml-auto w-36">
                <Search className="absolute left-2 top-2 size-3.5 text-stone-400" />
                <Input
                  aria-label="搜索节点"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索节点…"
                  className="h-8 rounded-md bg-stone-50 pl-7 text-xs"
                />
              </div>
            </div>
            <ScrollArea className="h-[min(46vh,420px)] rounded-lg border border-stone-200 bg-stone-50">
              <div
                role="group"
                aria-label="代理节点"
              >
                {nodes.map((node) => (
                  <button
                    key={node}
                    disabled={disabled || !status?.connected}
                    aria-pressed={status?.selected === node}
                    onClick={() => void run(() => window.electronAPI.selectBrowserProxy(node))}
                    className={`flex w-full items-center gap-3 border-b border-stone-100 px-3 py-2.5 text-left text-sm last:border-0 disabled:opacity-50 ${status?.connected && status?.selected === node ? "bg-green-50 text-green-700" : "text-stone-600 hover:bg-stone-100"}`}
                  >
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${status?.connected && status?.selected === node ? "border-green-600" : "border-stone-300"}`}>
                      {status?.connected && status?.selected === node && <span className="size-2 rounded-full bg-green-600" />}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{node}</span>
                    {status?.connected && status?.selected === node && <span className="shrink-0 rounded-md bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-600">使用中</span>}
                  </button>
                ))}
                {!nodes.length && <p className="p-6 text-center text-xs text-stone-400">{status?.nodes.length ? "没有匹配的节点" : "连接订阅后显示可用节点"}</p>}
              </div>
            </ScrollArea>
          </div>
        </ScrollArea>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-4 py-2.5 text-[11px] text-stone-400">
          <span className="flex items-center gap-1">
            <Info size={13} />
            仅代理 Vessel 内置浏览器
          </span>
          <button
            disabled={disabled || (!url && !status?.hasSubscription)}
            className="flex items-center gap-1 text-stone-500 hover:text-green-700 disabled:opacity-40"
            onClick={() => void run(() => window.electronAPI.connectBrowserProxy(url || undefined))}
          >
            <RefreshCw size={13} />
            更新订阅
          </button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
