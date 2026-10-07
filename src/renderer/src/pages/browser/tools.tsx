import { addTransit } from "@/components/transit/state"
import { useEffect, useRef, useState } from "react"
import type { WebviewTag } from "electron"
import { MoreHorizontal, ZoomIn, ZoomOut, Search, History, Printer, Pin, Smartphone, Tablet, Monitor, ChevronDown, X, RotateCw } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut } from "@/components/ui/dropdown-menu"
import { HistorySheet } from "./history-sheet"
import { toast } from "sonner"
import type { HistoryEntry, BrowserDevice } from "../../../../shared/browser-tools"
export function BrowserMore({ zoom, zoomFactor, onFind, onNavigate, guest, deviceMode, onDevice }: { zoomFactor: number; zoom: (delta: number) => void; onFind: () => void; onNavigate: (url: string) => void; guest: () => WebviewTag | undefined; deviceMode: boolean; onDevice: () => void }) {
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState("")
  const refresh = () => window.electronAPI.listBrowserHistory().then(setHistory).catch(error => setError(String(error)))
  const run = (action: () => void) => { setOpen(false); action() }
  const itemClass = "browser-more-item gap-2.5 rounded-md px-2.5 py-2 text-xs font-normal text-stone-600 focus:!bg-[#327f73] focus:!text-white data-[highlighted]:!bg-[#327f73] data-[highlighted]:!text-white [&>svg]:size-4 [&>svg]:text-stone-400 data-[highlighted]:[&>svg]:!text-white focus:[&>svg]:!text-white"
  return <><DropdownMenu open={open} onOpenChange={setOpen} modal={false}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="浏览器更多"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={8} className="z-[250] w-60 rounded-xl border-stone-200 bg-white p-1.5 shadow-lg">
    <div className="flex items-center justify-between gap-3 px-2.5 py-2"><span className="text-xs text-stone-500">页面缩放</span><div className="flex items-center rounded-md border border-stone-200 bg-stone-50 p-0.5">
      <button aria-label="缩小" title="缩小" disabled={zoomFactor <= 0.25} onClick={() => zoom(-0.1)} className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-[#327f73] hover:text-white disabled:opacity-30"><ZoomOut size={15} /></button>
      <span className="w-11 text-center text-[11px] tabular-nums text-stone-600">{Math.round(zoomFactor * 100)}%</span>
      <button aria-label="放大" title="放大" disabled={zoomFactor >= 3} onClick={() => zoom(0.1)} className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-[#327f73] hover:text-white disabled:opacity-30"><ZoomIn size={15} /></button>
    </div></div>
    <DropdownMenuSeparator className="mx-1 my-1 bg-stone-100" />
    <DropdownMenuItem className={itemClass} onSelect={() => run(onFind)}><Search />查找<DropdownMenuShortcut className="text-[10px]">⌘/Ctrl F</DropdownMenuShortcut></DropdownMenuItem>
    <DropdownMenuItem className={itemClass} onSelect={() => run(() => { setHistoryOpen(true); setError(""); void refresh() })}><History />历史记录</DropdownMenuItem>
    <DropdownMenuItem className={itemClass} onSelect={() => run(() => { try { const view = guest(); if (view) void window.electronAPI.printBrowserPage(view.getWebContentsId()).catch(e => toast.error(String(e))) } catch (e) { toast.error(String(e)) } })}><Printer />打印</DropdownMenuItem>
    <DropdownMenuSeparator className="mx-1 my-1 bg-stone-100" />
    <DropdownMenuItem className={itemClass} onSelect={() => run(onDevice)}><Smartphone />{deviceMode ? '隐藏' : '显示'}设备工具栏</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>
  <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} entries={history} error={error} onNavigate={onNavigate} onDelete={id => { void window.electronAPI.deleteBrowserHistory(id).then(refresh).catch(e => setError(String(e))) }} /></>
}
const responsive: BrowserDevice = { title: '自定义尺寸', width: 390, height: 844, deviceScaleFactor: 1, mobile: true, userAgent: '' }
export function DeviceToolbar({ guest, tabId, onClose, onViewport }: { guest: () => WebviewTag | undefined; tabId: string; onClose: () => void; onViewport: (value: { width: number; height: number; scale: number }) => void }) {
  const [devices, setDevices] = useState<BrowserDevice[]>([])
  const [device, setDevice] = useState(responsive)
  const [scale, setScale] = useState(1)
  useEffect(() => { onViewport({ width: device.width, height: device.height, scale }) }, [device.width, device.height, scale, onViewport])
  const [error, setError] = useState("")
  const guestRef = useRef(guest)
  useEffect(() => { guestRef.current = guest }, [guest])
  const read = () => window.electronAPI.listBrowserDevices().then(items => { setDevices(items); setError("") }).catch(e => setError(String(e)))
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const readReady = async (attempt: number) => {
      try { const items = await window.electronAPI.listBrowserDevices(); if (!cancelled) { setDevices(items); setError("") } }
      catch (e) { if (!cancelled) { if (attempt < 15) timer = setTimeout(() => void readReady(attempt + 1), 300); else setError(String(e)) } }
    }
    void readReady(0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [tabId])
  useEffect(() => {
    const view = guestRef.current()
    if (!view) return
    let id: number | undefined
    const apply = () => { try { id = view.getWebContentsId(); void window.electronAPI.emulateBrowserDevice(id, device).catch(e => setError(String(e))) } catch { /* Wait for guest readiness. */ } }
    apply(); view.addEventListener('dom-ready', apply)
    return () => { view.removeEventListener('dom-ready', apply); if (id !== undefined) void window.electronAPI.emulateBrowserDevice(id, null).catch(() => {}) }
  }, [tabId, device])
  const iconButton = "flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-stone-500 hover:border-stone-200 hover:bg-stone-50 hover:text-stone-800"
  return <div className="shrink-0 border-b bg-stone-50 px-3 py-2">
    <div className="flex h-12 items-center gap-1 rounded-[10px] border border-stone-200 bg-white px-2 shadow-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-stone-100 bg-stone-50 text-stone-600"><Smartphone size={16} /></span>
      <DropdownMenu><DropdownMenuTrigger asChild><button aria-label="模拟设备" className="flex h-8 min-w-28 items-center justify-between gap-2 rounded-md px-2 text-xs font-semibold hover:bg-stone-50"><span className="max-w-40 truncate">{device.title}</span><ChevronDown size={13} className="text-stone-400" /></button></DropdownMenuTrigger><DropdownMenuContent align="start" sideOffset={4} className="w-[260px] overflow-hidden rounded-[10px] border-stone-200 bg-white p-1 shadow-[0_8px_24px_#0000001a]"><ScrollArea className="h-[min(320px,var(--radix-dropdown-menu-content-available-height))] pr-2" type="auto">
        {['自定义', '手机', '平板', '桌面'].map(group => {
          const items = group === '自定义' ? [responsive] : devices.filter(item => (item.mobile ? /ipad|tablet|playbook|nexus (7|9|10)|surface/i.test(item.title) ? '平板' : '手机' : '桌面') === group)
          const Icon = group === '平板' ? Tablet : group === '桌面' ? Monitor : Smartphone
          return items.length > 0 && <div key={group}><div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold tracking-wide text-stone-400">{group}</div>{items.map((item, index) => <DropdownMenuItem key={`${item.title}-${index}`} data-selected={device.title === item.title} onSelect={() => setDevice(item)} className="device-menu-item gap-2 rounded-md px-2.5 py-1.5 text-[12.5px]"><Icon className="size-3.5 shrink-0 text-stone-400" /><span className="min-w-0 truncate">{item.title}</span><span className="ml-auto shrink-0 font-mono text-[11px] text-stone-400">{item.width}×{item.height}</span></DropdownMenuItem>)}</div>
        })}
      </ScrollArea></DropdownMenuContent></DropdownMenu>
      <span className="mx-1 h-5 w-px bg-stone-100" />
      <div className="flex items-center">
        <input aria-label="设备宽度" type="number" min={100} max={10000} defaultValue={device.width} key={`w-${device.width}`} onBlur={e => { const width = Number(e.target.value); if (width >= 100 && width <= 10000) setDevice({ ...device, title: responsive.title, width }); else e.target.value = String(device.width) }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }} className="device-size-input rounded-l-md" />
        <span className="flex h-8 w-6 items-center justify-center border-y border-stone-200 bg-stone-50 text-xs text-stone-400">×</span>
        <input aria-label="设备高度" type="number" min={100} max={10000} defaultValue={device.height} key={`h-${device.height}`} onBlur={e => { const height = Number(e.target.value); if (height >= 100 && height <= 10000) setDevice({ ...device, title: responsive.title, height }); else e.target.value = String(device.height) }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }} className="device-size-input rounded-r-md" />
      </div>
      <button className={iconButton} title="旋转设备" onClick={() => setDevice({ ...device, width: device.height, height: device.width })}><RotateCw size={15} /></button>
      <DropdownMenu><DropdownMenuTrigger asChild><button aria-label="设备显示缩放" className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-stone-600 hover:bg-stone-100">{Math.round(scale * 100)}%<ChevronDown size={13} /></button></DropdownMenuTrigger><DropdownMenuContent align="start" sideOffset={4} className="min-w-0 w-[100px] rounded-lg border-stone-200 bg-white p-[3px] shadow-[0_6px_20px_#00000014]">{[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <DropdownMenuItem key={value} onSelect={() => setScale(value)} data-selected={scale === value} className="device-menu-item justify-center rounded-[5px] px-2 py-[5px] text-xs font-medium">{Math.round(value * 100)}%</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      <button className={iconButton} aria-label="添加设备页面到中转站" title="添加到中转站" onClick={() => { try { const view = guest(); if (view && /^https?:\/\//i.test(view.getURL())) addTransit(view.getURL(), view.getTitle(), { device: { ...device }, scale }); else toast.error("请先打开网页") } catch (e) { toast.error(String(e)) } }}><Pin size={15} /></button>
      <div className="ml-auto flex items-center gap-1"><button className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-stone-600 hover:bg-stone-50" onClick={() => void read()}><RotateCw size={14} />刷新设备</button><span className="mx-1 h-5 w-px bg-stone-100" /><button className={iconButton} aria-label="关闭设备工具栏" onClick={onClose}><X size={15} /></button></div>
    </div>
    {error && <p role="alert" className="mt-1 text-center text-xs text-red-600">设备列表暂时不可用，请点击刷新设备重试。</p>}
  </div>
}
