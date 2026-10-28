import { ScrollArea } from "@/components/ui/scroll-area"
import { FilePreview } from "@/components/transit/file-preview"
import { TransitDock, type TransitDockMode } from "@/components/transit/panel/components/transit-dock"
import { TransitStatus } from "@/components/transit/panel/components/transit-status"
import "@/components/transit/panel/components/transit.css"
import type { TransitFile } from "@vessel/type"
import { WebPreview } from "@/components/transit/panel/components/web-preview"
import { selectTransit, useTransit } from "@/components/transit/state"
import { ResizableSplit } from "@/components/ui/resizable-split"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { ChevronLeft, ChevronRight, ExternalLink, Clipboard, FileText, Globe, Maximize, Minimize, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

/** Renders the transit panel component. */
export function TransitPanel() {
  const { items, selected } = useTransit()
  const index = items.findIndex((i) => i.id === selected)
  const item = items[index]
  const pageStart = Math.floor(Math.max(0, index) / 4) * 4
  const visibleItems = items.slice(pageStart, pageStart + 4)
  const [width, setWidth] = useState(() => Math.max(320, Math.min(900, Number(localStorage.getItem("vessel-transit-width")) || 420)))
  const [dock, setDock] = useState<TransitDockMode>("right")
  const [height, setHeight] = useState(300)
  const [refresh, setRefresh] = useState(0)
  const [searchRequest, setSearchRequest] = useState(0)
  const [loaded, setLoaded] = useState<{ id: string; file: TransitFile } | null>(null)
  /** Tracks preview metadata without re-reading the file. */
  const onLoaded = useCallback((file: TransitFile) => { if (item) setLoaded({ id: item.id, file }) }, [item?.id])
  /** Changes docking and exits fullscreen. */
  const changeDock = (value: TransitDockMode) => { setDock(value); setFull(false) }
  const left = dock === "left"
  const [full, setFull] = useState(false)
  const [position, setPosition] = useState({ x: 120, y: 70 })
  const gesture = useRef<{ x: number; y: number; left: number; top: number; width: number; resize?: boolean } | null>(null)

  /** Saves width. */
  const saveWidth = (value: number) => {
    setWidth(value)
    localStorage.setItem("vessel-transit-width", String(value))
  }

  /** Moves move. */
  const move = (event: React.PointerEvent<HTMLElement>) => {
    const start = gesture.current
    if (!start) return
    if (start.resize) saveWidth(Math.max(320, Math.min(window.innerWidth - position.x, start.width + event.clientX - start.x)))
    else setPosition({ x: Math.max(0, Math.min(window.innerWidth - Math.min(width, window.innerWidth), start.left + event.clientX - start.x)), y: Math.max(0, Math.min(window.innerHeight - 60, start.top + event.clientY - start.y)) })
  }

  /** Stops stop. */
  const stop = () => {
    gesture.current = null
  }

  const content = item && (
    <>
      <header
        style={{ cursor: dock === "floating" && !full ? "move" : undefined, touchAction: "none" }}
        onPointerDown={(event) => {
          if (dock !== "floating" || full || (event.target as HTMLElement).closest("button") || event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          gesture.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y, width }
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        className="transit-bar transit-top-bar"
      >
        <SheetTitle className="sr-only">{item.title}</SheetTitle>
        <SheetDescription className="sr-only">中转站预览：{item.kind === "text" ? "剪贴板文本" : item.content}</SheetDescription>
        <button data-title={full ? "还原" : "展开"} aria-label={full ? "还原" : "展开"} onClick={() => setFull(!full)} className="transit-bar-item">{full ? <Minimize /> : <Maximize />}</button>
        <button data-title="独立窗口" aria-label="独立窗口" onClick={() => void window.electronAPI.openTransitWindow(item, items.filter((entry) => entry.kind === "file" && entry.root).map((entry) => ({ root: entry.root!, content: entry.content }))).catch((error) => toast.error(String(error)))} className="transit-bar-item"><ExternalLink /></button>
        <TransitDock value={dock} onChange={changeDock} />
        <button data-title="关闭" aria-label="关闭中转站" onClick={() => selectTransit(null)} className="transit-bar-item transit-close"><X /></button>
      </header>
      <nav aria-label="中转项轮播" className="transit-bar transit-strip-bar">
        <button aria-label="上一个中转项" disabled={index <= 0} onClick={() => selectTransit(items[index - 1].id)} className="transit-bar-item"><ChevronLeft /></button>
        <div className="transit-strip-tabs" role="tablist" aria-label="中转项">
          {visibleItems.map((entry) => (
            <button role="tab" aria-selected={entry.id === selected} aria-label={entry.title} data-title={entry.title} key={entry.id} className="transit-strip-tab" onClick={() => selectTransit(entry.id)}>
              {entry.kind === "url" ? <Globe /> : entry.kind === "text" ? <Clipboard /> : <FileText />}
            </button>
          ))}
        </div>
        <button aria-label="下一个中转项" disabled={index >= items.length - 1} onClick={() => selectTransit(items[index + 1].id)} className="transit-bar-item"><ChevronRight /></button>
        <span aria-live="polite" className="transit-strip-count">{index + 1}/{items.length}</span>
      </nav>
      <div className="transit-sheet-body">
      {item.kind === "file" ? (
        <FilePreview
          key={`${item.id}-${refresh}`}
          item={item}
          onLoaded={onLoaded}
        />
      ) : item.kind === "url" ? (
        <WebPreview
          searchRequest={searchRequest}
          key={`${item.id}-${refresh}`}
          item={item}
        />
      ) : (
        <ScrollArea className="transit-text-scroll min-h-0 min-w-0 flex-1"><div className="transit-text-panel"><pre className="transit-clipboard-text">{item.content}</pre><p className="transit-type-hint"><Clipboard />来自剪贴板</p></div></ScrollArea>
      )}
      </div>
      <TransitStatus item={item} file={loaded?.id === item.id ? loaded.file : undefined} onSearch={() => setSearchRequest((value) => value + 1)} onRefresh={() => setRefresh((value) => value + 1)} />
    </>
  )
  return (
    <Sheet
      modal={false}
      open={!!item}
      onOpenChange={(open) => {
        if (!open) selectTransit(null)
      }}
    >
      <SheetContent
        showOverlay={false}
        showCloseButton={false}
        side="right"
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={dock === "floating" && !full ? { left: position.x, right: "auto", top: position.y, bottom: "auto", height: "80vh", width: Math.min(width, window.innerWidth) } : { left: 52, width: "calc(100vw - 52px)" }}
        className="z-[240] pointer-events-none [&_.vessel-panel-separator]:pointer-events-auto !max-w-none border-0 bg-transparent p-0 shadow-none"
      >
        {dock === "floating" && !full ? (
          <div className="transit-sheet pointer-events-auto relative flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-xl">
            {content}
            <div
              role="separator"
              aria-label="调整悬浮面板宽度"
              aria-orientation="vertical"
              className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none"
              onPointerDown={(event) => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                gesture.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y, width, resize: true }
              }}
              onPointerMove={move}
              onPointerUp={stop}
              onPointerCancel={stop}
            />
          </div>
        ) : (
          <ResizableSplit
            key={dock}
            side={dock === "bottom" ? "bottom" : left ? "left" : "right"}
            size={dock === "bottom" ? height : width}
            min={dock === "bottom" ? 180 : 320}
            max={dock === "bottom" ? window.innerHeight - 60 : Math.min(900, window.innerWidth - 52)}
            label={dock === "bottom" ? "调整中转站高度" : "调整中转站宽度"}
            onResize={dock === "bottom" ? setHeight : saveWidth}
            pane={!full ? <div className="transit-sheet transit-resizable-content pointer-events-auto flex h-full min-w-0 flex-col bg-white shadow-lg">{content}</div> : undefined}
          >
            {full ? <div className="transit-sheet pointer-events-auto flex h-full flex-col bg-white">{content}</div> : <div className="h-full" />}
          </ResizableSplit>
        )}
      </SheetContent>
    </Sheet>
  )
}
