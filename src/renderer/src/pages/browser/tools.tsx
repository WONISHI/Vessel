import { useEffect, useRef, useState } from "react"
import type { WebviewTag } from "electron"
import { MoreHorizontal, ZoomIn, ZoomOut, Search, History, Printer, Smartphone, Trash2, X, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { toast } from "sonner"
import type { HistoryEntry, BrowserDevice } from "../../../../shared/browser-tools"
export function BrowserMore({ zoom, zoomFactor, onFind, onNavigate, guest, deviceMode, onDevice }: { zoomFactor: number; zoom: (delta: number) => void; onFind: () => void; onNavigate: (url: string) => void; guest: () => WebviewTag | undefined; deviceMode: boolean; onDevice: () => void }) {
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState("")
  const refresh = () => window.electronAPI.listBrowserHistory().then(setHistory).catch(error => setError(String(error)))
  const run = (action: () => void) => { setOpen(false); action() }
  const itemClass = "gap-2.5 rounded-md px-2.5 py-2 text-xs font-normal text-stone-600 focus:bg-green-800 focus:text-white [&>svg]:size-4 [&>svg]:text-stone-400 focus:[&>svg]:text-white"
  return <><DropdownMenu open={open} onOpenChange={setOpen} modal={false}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="浏览器更多"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-xl border-stone-200 bg-white p-1.5 shadow-lg">
    <div className="flex items-center justify-between gap-3 px-2.5 py-2"><span className="text-xs text-stone-500">页面缩放</span><div className="flex items-center rounded-md border border-stone-200 bg-stone-50 p-0.5">
      <button aria-label="缩小" title="缩小" disabled={zoomFactor <= 0.25} onClick={() => zoom(-0.1)} className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-green-800 hover:text-white disabled:opacity-30"><ZoomOut size={15} /></button>
      <span className="w-11 text-center text-[11px] tabular-nums text-stone-600">{Math.round(zoomFactor * 100)}%</span>
      <button aria-label="放大" title="放大" disabled={zoomFactor >= 3} onClick={() => zoom(0.1)} className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-green-800 hover:text-white disabled:opacity-30"><ZoomIn size={15} /></button>
    </div></div>
    <DropdownMenuSeparator className="mx-1 my-1 bg-stone-100" />
    <DropdownMenuItem className={itemClass} onSelect={() => run(onFind)}><Search />查找<DropdownMenuShortcut className="text-[10px]">⌘/Ctrl F</DropdownMenuShortcut></DropdownMenuItem>
    <DropdownMenuItem className={itemClass} onSelect={() => run(() => { setHistoryOpen(true); setError(""); void refresh() })}><History />历史记录</DropdownMenuItem>
    <DropdownMenuItem className={itemClass} onSelect={() => run(() => { try { const view = guest(); if (view) void window.electronAPI.printBrowserPage(view.getWebContentsId()).catch(e => toast.error(String(e))) } catch (e) { toast.error(String(e)) } })}><Printer />打印</DropdownMenuItem>
    <DropdownMenuSeparator className="mx-1 my-1 bg-stone-100" />
    <DropdownMenuItem className={itemClass} onSelect={() => run(onDevice)}><Smartphone />{deviceMode ? '隐藏' : '显示'}设备工具栏</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>
  <Sheet open={historyOpen} onOpenChange={setHistoryOpen}><SheetContent className="flex w-[420px] flex-col"><SheetHeader><SheetTitle>浏览历史</SheetTitle><SheetDescription>仅保留最近 30 天的浏览记录</SheetDescription></SheetHeader>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <Button variant="outline" disabled={!history.length} onClick={() => { void window.electronAPI.deleteBrowserHistory(null).then(refresh).catch(e => setError(String(e))) }}>清空历史记录</Button>
    <div className="min-h-0 flex-1 overflow-auto">{!history.length && <p className="p-5 text-sm text-stone-400">暂无浏览记录</p>}{history.map(item => <div key={item.id} className="flex items-center gap-2 border-b py-3"><button className="min-w-0 flex-1 text-left" onClick={() => { onNavigate(item.url); setHistoryOpen(false) }}><span className="block truncate text-sm">{item.title}</span><span className="block truncate text-xs text-stone-400">{item.url}</span><time className="text-xs text-stone-400">{new Date(item.visitedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></button><Button variant="ghost" size="icon" aria-label={`删除记录 ${item.title}`} onClick={() => { void window.electronAPI.deleteBrowserHistory(item.id).then(refresh).catch(e => setError(String(e))) }}><Trash2 className="size-4" /></Button></div>)}</div>
  </SheetContent></Sheet></>
}
const responsive: BrowserDevice = { title: '自定义尺寸', width: 390, height: 844, deviceScaleFactor: 1, mobile: true, userAgent: '' }
export function DeviceToolbar({ guest, tabId, onClose }: { guest: () => WebviewTag | undefined; tabId: string; onClose: () => void }) {
  const [devices, setDevices] = useState<BrowserDevice[]>([])
  const [device, setDevice] = useState(responsive)
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
  return <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b bg-stone-100 px-3 py-2 text-xs">
    <Smartphone size={15} /><select aria-label="模拟设备" value={device.title} onChange={e => setDevice(devices.find(item => item.title === e.target.value) || responsive)}><option>{responsive.title}</option>{devices.map((item, index) => <option key={`${item.title}-${index}`}>{item.title}</option>)}</select>
    <input aria-label="设备宽度" type="number" min={100} max={10000} value={device.width} onChange={e => { const width = Number(e.target.value); if (width >= 100 && width <= 10000) setDevice({ ...device, title: responsive.title, width }) }} className="w-16 rounded border px-1" /> ×
    <input aria-label="设备高度" type="number" min={100} max={10000} value={device.height} onChange={e => { const height = Number(e.target.value); if (height >= 100 && height <= 10000) setDevice({ ...device, title: responsive.title, height }) }} className="w-16 rounded border px-1" />
    <button title="旋转设备" onClick={() => setDevice({ ...device, width: device.height, height: device.width })}><RotateCw size={15} /></button>
    <button onClick={() => void read()}>刷新控制台设备</button><button aria-label="关闭设备工具栏" onClick={onClose}><X size={15} /></button>
    {error && <span role="alert" className="w-full text-center text-red-600">{error}</span>}
  </div>
}
