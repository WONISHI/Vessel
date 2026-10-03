import Clock from "react-live-clock"
import { ResizeEdge } from "@/components/ui/resize-edge"
import { FilePreview } from "./file-preview"
import { useEffect, useRef, useState } from "react"
import { Globe, FileText, Maximize, Minimize, ExternalLink, PanelRight, ChevronLeft, ChevronRight, RotateCw, X } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { toast } from "sonner"
import { selectTransit, useTransit, type TransitItem } from "./state"
function WebPreview({ item }: { item: TransitItem }) {
  const ref = useRef<Electron.WebviewTag>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [address, setAddress] = useState(item.content)
  const [history, setHistory] = useState({ back: false, forward: false })
  useEffect(() => {
    const view = ref.current
    if (!view) return
    const update = () => { setReady(true); setAddress(view.getURL()); setHistory({ back: view.canGoBack(), forward: view.canGoForward() }) }
    const emulate = () => { if (item.preview) void window.electronAPI.emulateBrowserDevice(view.getWebContentsId(), item.preview.device).catch(e => setError(String(e))) }
    view.addEventListener("dom-ready", emulate)
    const start = () => { setError("") }
    const fail = (event: Event) => { const e = event as Electron.DidFailLoadEvent; if (e.isMainFrame && e.errorCode !== -3) setError(`网页加载失败：${e.errorDescription}`) }
    view.addEventListener("dom-ready", update); view.addEventListener("did-navigate", update); view.addEventListener("did-navigate-in-page", update); view.addEventListener("did-start-loading", start); view.addEventListener("did-fail-load", fail)
    return () => { view.removeEventListener("dom-ready", emulate); view.removeEventListener("dom-ready", update); view.removeEventListener("did-navigate", update); view.removeEventListener("did-navigate-in-page", update); view.removeEventListener("did-start-loading", start); view.removeEventListener("did-fail-load", fail) }
  }, [item.preview])
  const act = (action: "goBack" | "goForward" | "reload") => { try { if (ready) ref.current?.[action]() } catch (error) { toast.error(String(error)) } }
  return <><div className="flex items-center gap-2 border-b bg-stone-50 px-3 py-2 text-stone-400">
    <button aria-label="后退" disabled={!ready || !history.back} onClick={() => act("goBack")} className="disabled:opacity-30"><ChevronLeft className="size-4" /></button>
    <button aria-label="前进" disabled={!ready || !history.forward} onClick={() => act("goForward")} className="disabled:opacity-30"><ChevronRight className="size-4" /></button>
    <button aria-label="刷新" disabled={!ready} onClick={() => act("reload")}><RotateCw className="size-4" /></button>
    <span className="min-w-0 flex-1 truncate rounded-md border bg-white px-2 py-1 text-xs">{address}</span>
  </div>{error && <div role="alert" className="bg-red-50 p-3 text-xs text-red-700">{error}</div>}{!ready && !error && <p role="status" className="p-3 text-xs text-stone-400">正在加载网页…</p>}<div className={`min-h-0 flex-1 ${item.preview ? 'overflow-auto bg-stone-100 p-4' : 'flex'}`}><div style={item.preview ? { width: item.preview.device.width, height: item.preview.device.height, margin: '0 auto', overflow: 'hidden', border: '1px solid #d6d3d1', boxSizing: 'content-box', borderRadius: 4, background: 'white' } : { width: '100%', height: '100%' }}><div style={item.preview ? { width: item.preview.device.width, height: item.preview.device.height, transform: `scale(${item.preview.scale})`, transformOrigin: 'top left' } : { width: '100%', height: '100%' }}><webview ref={ref} src={item.content} {...{ partition: "persist:vessel-transit" }} style={{ width: '100%', height: '100%', display: 'flex' }} /></div></div></div></>
}
export function TransitPanel() {
  const { items, selected } = useTransit()
  const item = items.find(i => i.id === selected)
  const [width, setWidth] = useState(() => Math.max(320, Math.min(900, Number(localStorage.getItem("vessel-transit-width")) || 480)))
  const [dock, setDock] = useState<"left" | "right" | "floating">("right")
  const left = dock === "left"
  const [full, setFull] = useState(false)
  return <Sheet modal={false} open={!!item} onOpenChange={open => { if (!open) selectTransit(null) }}><SheetContent showOverlay={false} showCloseButton={false} style={full ? undefined : { width: `min(${width}px, calc(100vw - 52px))`, ...(dock === "floating" ? { left: "50%", right: "auto", top: "10vh", bottom: "auto", height: "80vh", transform: "translateX(-50%)" } : {}) }} side={left ? "left" : "right"} onInteractOutside={e => e.preventDefault()} onOpenAutoFocus={e => e.preventDefault()} className={`flex flex-col gap-0 bg-white p-0 ${dock === "floating" && !full ? "rounded-xl border" : ""} ${full ? "!w-[calc(100vw-52px)] !max-w-none !left-[52px]" : "!max-w-none"} ${left ? "!left-[52px]" : ""}`}>
    {!full && <ResizeEdge width={width} min={320} max={Math.min(900, window.innerWidth - 52)} side={left ? "right" : "left"} label="调整中转站宽度" onChange={value => { setWidth(value); localStorage.setItem("vessel-transit-width", String(value)) }} />}
    {item && <><header className="flex items-center gap-2 border-b p-3"><span className="rounded-lg bg-emerald-50 p-2 text-green-600">{item.kind === "url" ? <Globe className="size-4" /> : <FileText className="size-4" />}</span><div className="min-w-0 flex-1"><SheetTitle className="truncate text-sm">{item.title}</SheetTitle><SheetDescription className="truncate text-[11px] text-stone-400">{item.kind === "text" ? "剪贴板文本" : item.content}</SheetDescription></div>
      <button title={full ? "还原" : "展开"} aria-label={full ? "还原" : "展开"} onClick={() => setFull(!full)} className="rounded p-1.5 text-stone-500 hover:bg-stone-100">{full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}</button>
      <button title="独立窗口" aria-label="独立窗口" onClick={() => void window.electronAPI.openTransitWindow(item).catch(error => toast.error(String(error)))} className="rounded p-1.5 text-stone-500 hover:bg-stone-100"><ExternalLink className="size-4" /></button>
      <div className="group relative self-center">
        <button aria-label="中转站停靠方式" className="flex items-center rounded bg-emerald-50 p-1.5 text-green-600"><PanelRight className="size-4" /></button>
        <div className="absolute right-0 top-full z-[70] hidden w-36 pt-2 group-hover:block group-focus-within:block">
          <div className="rounded-lg border bg-white p-1 shadow-lg">
            {([["left", "左侧边停靠"], ["right", "右侧边停靠"], ["floating", "悬浮停靠"]] as const).map(([value, label]) => <button key={value} aria-pressed={dock === value} onClick={() => { setDock(value); setFull(false) }} className={`block w-full rounded px-3 py-2 text-left text-xs hover:bg-emerald-50 ${dock === value ? "text-green-600" : "text-stone-600"}`}>{label}</button>)}
          </div>
        </div>
      </div>
      <button aria-label="关闭中转站" title="关闭" onClick={() => selectTransit(null)} className="rounded p-1.5 text-stone-500 hover:bg-stone-100"><X className="size-4" /></button>
    </header>{item.kind === "file" ? <FilePreview key={item.id} item={item} /> : item.kind === "url" ? <WebPreview key={item.id} item={item} /> : <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-5 font-sans text-sm leading-7 text-stone-700">{item.content}</pre>}<footer className="border-t bg-stone-50 px-3 py-2 text-right text-[11px] text-stone-400"><Clock format="YYYY年MM月DD日 HH:mm" ticking interval={1000} /></footer></>}
  </SheetContent></Sheet>
}
