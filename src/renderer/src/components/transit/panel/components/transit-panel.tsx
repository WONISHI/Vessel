import { FilePreview } from "@/components/transit/file-preview"
import { formatTransitDate } from "@/components/transit/panel/components/panel-shared"
import { WebPreview } from "@/components/transit/panel/components/web-preview"
import { selectTransit, useTransit } from "@/components/transit/state"
import { ResizableSplit } from "@/components/ui/resizable-split"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Globe, Maximize, Minimize, PanelRight, X } from "lucide-react"
import { useRef, useState } from "react"
import Clock from "react-live-clock"
import { toast } from "sonner"

/** Renders the transit panel component. */
export function TransitPanel() {
  const { items, selected } = useTransit()
  const index = items.findIndex((i) => i.id === selected)
  const item = items[index]
  const [width, setWidth] = useState(() => Math.max(320, Math.min(900, Number(localStorage.getItem("vessel-transit-width")) || 480)))
  const [dock, setDock] = useState<"left" | "right" | "floating">("right")
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
        className="flex items-center gap-2 border-b p-3"
      >
        <span className="rounded-lg bg-emerald-50 p-2 text-green-600">{item.kind === "url" ? <Globe className="size-4" /> : <FileText className="size-4" />}</span>
        <div className="min-w-0 flex-1">
          <SheetTitle className="truncate text-sm">{item.title}</SheetTitle>
          <SheetDescription className="truncate text-[11px] text-stone-400">{item.kind === "text" ? "剪贴板文本" : item.content}</SheetDescription>
        </div>
        <button
          title={full ? "还原" : "展开"}
          aria-label={full ? "还原" : "展开"}
          onClick={() => setFull(!full)}
          className="rounded p-1.5 text-stone-500 hover:bg-stone-100"
        >
          {full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </button>
        <button
          title="独立窗口"
          aria-label="独立窗口"
          onClick={() => void window.electronAPI.openTransitWindow(item).catch((error) => toast.error(String(error)))}
          className="rounded p-1.5 text-stone-500 hover:bg-stone-100"
        >
          <ExternalLink className="size-4" />
        </button>
        <div className="group relative self-center">
          <button
            aria-label="中转站停靠方式"
            className="flex items-center rounded bg-emerald-50 p-1.5 text-green-600"
          >
            <PanelRight className="size-4" />
          </button>
          <div className="absolute right-0 top-full z-[70] hidden w-36 pt-2 group-hover:block group-focus-within:block">
            <div className="rounded-lg border bg-white p-1 shadow-lg">
              {(
                [
                  ["left", "左侧边停靠"],
                  ["right", "右侧边停靠"],
                  ["floating", "悬浮停靠"]
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={dock === value}
                  onClick={() => {
                    setDock(value)
                    setFull(false)
                  }}
                  className={`block w-full rounded px-3 py-2 text-left text-xs hover:bg-emerald-50 ${dock === value ? "text-green-600" : "text-stone-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          aria-label="关闭中转站"
          title="关闭"
          onClick={() => selectTransit(null)}
          className="rounded p-1.5 text-stone-500 hover:bg-stone-100"
        >
          <X className="size-4" />
        </button>
      </header>
      {items.length > 1 && (
        <nav
          aria-label="中转项轮播"
          className="flex shrink-0 items-center justify-center gap-3 border-b bg-stone-50/70 px-3 py-1"
        >
          <button
            aria-label="上一个中转项"
            disabled={index <= 0}
            onClick={() => selectTransit(items[index - 1].id)}
            className="rounded p-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            aria-live="polite"
            className="text-[11px] text-stone-400"
          >
            {index + 1} / {items.length}
          </span>
          <button
            aria-label="下一个中转项"
            disabled={index >= items.length - 1}
            onClick={() => selectTransit(items[index + 1].id)}
            className="rounded p-1 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
      {item.kind === "file" ? (
        <FilePreview
          key={item.id}
          item={item}
        />
      ) : item.kind === "url" ? (
        <WebPreview
          key={item.id}
          item={item}
        />
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-5 font-sans text-sm leading-7 text-stone-700">{item.content}</pre>
      )}
      <footer className="border-t bg-stone-50 px-3 py-2 text-right text-[11px] text-stone-400">
        <Clock
          format="YYYY年MM月DD日 HH:mm"
          ticking
          interval={1000}
          filter={() => formatTransitDate(new Date())}
        />
      </footer>
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
          <div className="pointer-events-auto relative flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-xl">
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
            side={left ? "left" : "right"}
            size={width}
            min={320}
            max={Math.min(900, window.innerWidth - 52)}
            label="调整中转站宽度"
            onResize={saveWidth}
            pane={!full ? <div className="transit-resizable-content pointer-events-auto flex h-full min-w-0 flex-col bg-white shadow-lg">{content}</div> : undefined}
          >
            {full ? <div className="pointer-events-auto flex h-full flex-col bg-white">{content}</div> : <div className="h-full" />}
          </ResizableSplit>
        )}
      </SheetContent>
    </Sheet>
  )
}
