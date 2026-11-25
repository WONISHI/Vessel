import { ProxyTelemetry } from "./telemetry"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import "@/pages/debug/workbench.css"
import "./proxy.css"
import "@/components/styles/tool-page-header.css"
import { useProxyEnabled } from "./use-proxy-enabled"
import type { BrowserProxyStatus, BrowserProxySubscription } from "@vessel/type"
import { Eye, EyeOff, Link, MapPin, Search, Shield, Unlink, Plus, Pencil, Trash2 } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

export default function ProxyTool() {
  const enabled = useProxyEnabled()
  const [search, setSearch] = useState("")
  const [subscriptions, setSubscriptions] = useState<BrowserProxySubscription[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [editor, setEditor] = useState<Partial<BrowserProxySubscription> | null>(null)
  const [status, setStatus] = useState<BrowserProxyStatus>()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const selected = subscriptions.find(item => item.id === selectedId)
  const selectedConnected = !!status?.connected && status.subscriptionId === selectedId
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const refresh = () => {
      void window.electronAPI.browserProxyStatus().then(value => { if (alive) setStatus(value) }).catch(() => {})
    }
    refresh()
    void window.electronAPI.listBrowserProxySubscriptions().then(items => {
      if (!alive) return
      setSubscriptions(items)
      const saved = localStorage.getItem("vessel:proxy-subscription")
      setSelectedId(items.some(item => item.id === saved) ? saved! : items[0]?.id || "")
    }).catch(reason => { if (alive) setError(String(reason)) })
    const timer = setInterval(refresh, 1000)
    return () => { alive = false; clearInterval(timer) }
  }, [enabled])
  const choose = (id: string) => {
    setSelectedId(id)
    localStorage.setItem("vessel:proxy-subscription", id)
  }
  async function run(action: () => Promise<BrowserProxyStatus>) {
    setPending(true); setError("")
    try {
      setStatus(await action())
      void window.electronAPI.listBrowserProxySubscriptions().then(setSubscriptions).catch(() => {})
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败") }
    finally { setPending(false) }
  }
  async function refreshInfo() {
    if (!selected || refreshing) return
    setRefreshing(true); setError("")
    try {
      const item = await window.electronAPI.refreshBrowserProxySubscriptionInfo(selected.id)
      setSubscriptions(previous => previous.map(profile => profile.id === item.id ? item : profile))
    } catch (reason) { setError(reason instanceof Error ? reason.message : "更新订阅信息失败") }
    finally { setRefreshing(false) }
  }
  async function save(input: { id?: string; name: string; url: string }) {
    const item = await window.electronAPI.saveBrowserProxyProfile(input)
    setSubscriptions(previous => previous.some(profile => profile.id === item.id) ? previous.map(profile => profile.id === item.id ? item : profile) : [...previous, item])
    choose(item.id)
    setEditor(null)
  }
  async function remove(item: BrowserProxySubscription) {
    setPending(true); setError("")
    try {
      await window.electronAPI.deleteBrowserProxyProfile(item.id)
      const remaining = subscriptions.filter(profile => profile.id !== item.id)
      setSubscriptions(remaining)
      if (selectedId === item.id) choose(remaining[0]?.id || "")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败") }
    finally { setPending(false) }
  }
  const nodes = (status?.nodes || []).filter(node => node.toLowerCase().includes(search.toLowerCase()))
  const disabled = pending || status?.busy
  if (!enabled) return <div className="dev-tool-page flex h-full items-center justify-center p-6 text-sm text-muted-foreground">请先在设置的通用配置中开启代理。</div>
  return (
    <div className="dev-tool-page dev-proxy-page">
      <header className="tool-page-header">
        <div className="tool-page-brand"><Shield /></div>
        <div className="tool-page-heading"><h2>代理</h2><p>管理浏览器代理订阅、连接与节点</p></div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" disabled={disabled} onClick={() => setEditor({})}><Plus size={14} />新增订阅</Button>
          <Button disabled={disabled || !selected} onClick={() => void run(() => selectedConnected ? window.electronAPI.disconnectBrowserProxy() : window.electronAPI.connectBrowserProxyProfile(selectedId))} className="dev-primary-action">
            {selectedConnected ? <Unlink size={14} /> : <Link size={14} />}{selectedConnected ? "断开" : "连接"}
          </Button>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="dev-proxy-content">
          <section className="dev-proxy-panel dev-proxy-side-panel" aria-label="订阅管理">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">订阅</h3><span className="text-xs text-muted-foreground">{subscriptions.length} 个订阅</span></div>
            <ScrollArea className="h-[min(46vh,420px)]">
              <div className="space-y-1" role="group" aria-label="订阅列表">
                {subscriptions.map(item => {
                  const connected = !!status?.connected && status.subscriptionId === item.id
                  let host = ""
                  try { host = new URL(item.url).host } catch { /* Invalid legacy address remains editable. */ }
                  return <div key={item.id} className="dev-proxy-subscription" data-selected={selectedId === item.id}>
                    <button type="button" aria-label={`选择订阅 ${item.name}`} aria-pressed={selectedId === item.id} onClick={() => choose(item.id)} className="min-w-0 flex-1 text-left px-3 py-2">
                      <span className="flex items-center gap-2 text-xs"><Link size={14} /><span className="truncate font-medium">{item.name}</span>{connected && <span className="text-[10px] text-green-600">已连接</span>}</span>
                      <span className="mt-1 block truncate text-[11px] text-muted-foreground">{host}</span>
                    </button>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`编辑订阅 ${item.name}`} disabled={disabled || connected} onClick={() => setEditor(item)}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0 text-red-600" aria-label={`删除订阅 ${item.name}`} disabled={disabled || connected} onClick={() => void remove(item)}><Trash2 size={13} /></Button>
                  </div>
                })}
                {!subscriptions.length && <p className="p-6 text-center text-xs text-muted-foreground">暂无订阅，点击右上角“新增订阅”添加。</p>}
              </div>
            </ScrollArea>
            <p role="status" className="mt-3 text-xs text-muted-foreground">{status?.stage || "未连接"}</p>
            {(error || status?.error) && <p role="alert" className="mt-2 break-words text-xs text-red-600">{error || status?.error}</p>}
          </section>
            <ProxyTelemetry status={status} subscription={selected} busy={!!disabled} refreshing={refreshing} onRefresh={() => void refreshInfo()} onConfigure={input => void run(() => window.electronAPI.setBrowserProxyRuntime(input))}/>
            <section className="dev-proxy-panel dev-proxy-side-panel" aria-label="节点管理">
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
            </section>
        </div>
      </ScrollArea>
      {editor && <SubscriptionDialog initial={editor} onClose={() => setEditor(null)} onSave={save} />}
    </div>
  )
}

function SubscriptionDialog({ initial, onClose, onSave }: { initial: Partial<BrowserProxySubscription>; onClose: () => void; onSave: (input: { id?: string; name: string; url: string }) => Promise<void> }) {
  const [name, setName] = useState(initial.name || "")
  const [url, setURL] = useState(initial.url || "")
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError("")
    try { await onSave({ id: initial.id, name: name.trim(), url: url.trim() }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败") }
    finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-w-md gap-0 p-0">
      <DialogHeader className="border-b px-5 py-4"><DialogTitle>{initial.id ? "编辑订阅" : "新增订阅"}</DialogTitle><DialogDescription>填写订阅名称和 Clash 订阅地址。</DialogDescription></DialogHeader>
      <form onSubmit={event => void submit(event)}>
        <div className="space-y-4 px-5 py-4">
          <label className="block space-y-2 text-sm">名称<Input autoFocus aria-label="订阅名称" value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="例如：日常使用" required disabled={busy} /></label>
          <label className="block space-y-2 text-sm">地址<div className="relative"><Input aria-label="订阅地址" type={reveal ? "text" : "password"} value={url} onChange={event => setURL(event.target.value)} maxLength={8192} placeholder="https://…" className="pr-10" required disabled={busy} /><button type="button" aria-label={reveal ? "隐藏订阅地址" : "显示订阅地址"} onClick={() => setReveal(!reveal)} className="absolute right-3 top-2.5 text-muted-foreground">{reveal ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" disabled={busy || !name.trim() || !url.trim()}>{busy ? "保存中…" : "保存订阅"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
}
