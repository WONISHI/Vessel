import { useEffect, useRef, useState } from "react"
import { Globe, FileText, Maximize, Minimize, ExternalLink, PanelRight, ChevronLeft, ChevronRight, RotateCw } from "lucide-react"
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
    const start = () => { setError("") }
    const fail = (event: Event) => { const e = event as Electron.DidFailLoadEvent; if (e.isMainFrame && e.errorCode !== -3) setError(`网页加载失败：${e.errorDescription}`) }
    view.addEventListener("dom-ready", update); view.addEventListener("did-navigate", update); view.addEventListener("did-navigate-in-page", update); view.addEventListener("did-start-loading", start); view.addEventListener("did-fail-load", fail)
    return () => { view.removeEventListener("dom-ready", update); view.removeEventListener("did-navigate", update); view.removeEventListener("did-navigate-in-page", update); view.removeEventListener("did-start-loading", start); view.removeEventListener("did-fail-load", fail) }
  }, [])
  const act = (action: "goBack" | "goForward" | "reload") => { try { if (ready) ref.current?.[action]() } catch (error) { toast.error(String(error)) } }
  return <><div className="flex items-center gap-2 border-b bg-stone-50 px-3 py-2 text-stone-400">
    <button aria-label="后退" disabled={!ready || !history.back} onClick={() => act("goBack")} className="disabled:opacity-30"><ChevronLeft className="size-4" /></button>
    <button aria-label="前进" disabled={!ready || !history.forward} onClick={() => act("goForward")} className="disabled:opacity-30"><ChevronRight className="size-4" /></button>
    <button aria-label="刷新" disabled={!ready} onClick={() => act("reload")}><RotateCw className="size-4" /></button>
    <span className="min-w-0 flex-1 truncate rounded-md border bg-white px-2 py-1 text-xs">{address}</span>
  </div>{error && <div role="alert" className="bg-red-50 p-3 text-xs text-red-700">{error}</div>}{!ready && !error && <p role="status" className="p-3 text-xs text-stone-400">正在加载网页…</p>}<webview ref={ref} src={item.content} {...{ partition: "persist:vessel-transit" }} className="min-h-0 w-full flex-1" /></>
}
export function TransitPanel() {
  const { items, selected } = useTransit()
  const item = items.find(i => i.id === selected)
  const [left, setLeft] = useState(false)
  const [full, setFull] = useState(false)
  return <Sheet modal={false} open={!!item} onOpenChange={open => { if (!open) selectTransit(null) }}><SheetContent showOverlay={false} side={left ? "left" : "right"} onInteractOutside={e => e.preventDefault()} onOpenAutoFocus={e => e.preventDefault()} className={`flex flex-col gap-0 bg-white p-0 ${full ? "!w-[calc(100vw-52px)] !max-w-none !left-[52px]" : "!w-[min(480px,calc(100vw-52px))] !max-w-none"} ${left ? "!left-[52px]" : ""}`}>
    {item && <><header className="flex items-center gap-2 border-b p-3 pr-12"><span className="rounded-lg bg-emerald-50 p-2 text-green-600">{item.kind === "url" ? <Globe className="size-4" /> : <FileText className="size-4" />}</span><div className="min-w-0 flex-1"><SheetTitle className="truncate text-sm">{item.title}</SheetTitle><SheetDescription className="truncate text-[11px] text-stone-400">{item.kind === "url" ? item.content : "剪贴板文本"}</SheetDescription></div>
      <button title={full ? "还原" : "展开"} aria-label={full ? "还原" : "展开"} onClick={() => setFull(!full)} className="rounded p-1.5 text-stone-500 hover:bg-stone-100">{full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}</button>
      <button title="独立窗口" aria-label="独立窗口" onClick={() => void window.electronAPI.openTransitWindow(item).catch(error => toast.error(String(error)))} className="rounded p-1.5 text-stone-500 hover:bg-stone-100"><ExternalLink className="size-4" /></button>
      <button title={left ? "停靠右侧" : "停靠左侧"} aria-label={left ? "停靠右侧" : "停靠左侧"} onClick={() => setLeft(!left)} className="rounded bg-emerald-50 p-1.5 text-green-600"><PanelRight className="size-4" /></button>
    </header>{item.kind === "url" ? <WebPreview key={item.id} item={item} /> : <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-5 font-sans text-sm leading-7 text-stone-700">{item.content}</pre>}<footer className="border-t bg-stone-50 px-3 py-2 text-[11px] text-stone-400"><span className="mr-2 inline-block size-1.5 rounded-full bg-green-600" />已保存 · 中转站</footer></>}
  </SheetContent></Sheet>
}
