import { TransitTextPreview } from "@/components/transit/text-preview"
import { lazyWithRetry } from "@/lib/lazy-retry"
import { TransitDock, type TransitDockMode } from "@/components/transit/panel/components/transit-dock"
import { TransitStatus } from "@/components/transit/panel/components/transit-status"
import "@/components/transit/panel/components/transit.css"
import type { TransitFile } from "@vessel/type"
import { WebPreview } from "@/components/transit/panel/components/web-preview"
import { addTransit, addTransitFile, selectTransit, useTransit } from "@/components/transit/state"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { ChevronLeft, ChevronRight, Clipboard, ClipboardPaste, Upload, FileText, Globe, PanelTopClose, PanelTopOpen, PanelBottomOpen, PanelBottomClose } from "lucide-react"
import "@vscode/codicons/dist/codicon.css"
import { Suspense, useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { useActivityBarCollapsed } from "@/features/activity-bar/collapse"

const FilePreview = lazyWithRetry(() => import("@/components/transit/file-preview").then(({ FilePreview }) => ({ default: FilePreview })))

/** Renders the transit panel component. */
export function TransitPanel() {
  const activityCollapsed = useActivityBarCollapsed()
  const [statusVisible, setStatusVisible] = useState(() => localStorage.getItem("vessel-transit-status-visible") !== "false")
  const { items, selected } = useTransit()
  const index = items.findIndex((i) => i.id === selected)
  const item = items[index]
  const pageStart = Math.floor(Math.max(0, index) / 4) * 4
  const visibleItems = items.slice(pageStart, pageStart + 4)
  const [width, setWidth] = useState(() => Math.max(320, Math.min(900, Number(localStorage.getItem("vessel-transit-width")) || 420)))
  const [dock, setDock] = useState<TransitDockMode>("right")
  const [height, setHeight] = useState(300)
  const [tabsVisible, setTabsVisible] = useState(() => localStorage.getItem("vessel-transit-tabs-visible") !== "false")
  const [imageDetailsHidden, setImageDetailsHidden] = useState<Record<string, boolean>>({})
  const [refresh, setRefresh] = useState(0)
  const [searchRequest, setSearchRequest] = useState(0)
  const [loaded, setLoaded] = useState<{ id: string; file: TransitFile } | null>(null)
  const [adding, setAdding] = useState(false)
  const importFiles = async () => {
    setAdding(true)
    try {
      const files = await window.electronAPI.importTransitFiles()
      files.forEach(file => addTransitFile(file.root, file.path, file.title))
    } catch (error) { toast.error("导入文件失败", { description: String(error) }) }
    finally { setAdding(false) }
  }
  const readClipboard = async () => {
    setAdding(true)
    try {
      const value = await window.electronAPI.readTransitClipboard()
      if (typeof value === "string") addTransit(value)
      else addTransitFile(value.root, value.path, value.title)
    } catch (error) { toast.error("读取剪贴板失败", { description: String(error) }) }
    finally { setAdding(false) }
  }
  /** Tracks preview metadata without re-reading the file. */
  const onLoaded = useCallback((file: TransitFile) => { if (item) setLoaded({ id: item.id, file }) }, [item?.id])
  /** Changes docking and exits fullscreen. */
  const changeDock = (value: TransitDockMode) => { setDock(value); setFull(false) }
  const left = dock === "left"
  const vertical = dock === "top" || dock === "bottom"
  const [full, setFull] = useState(false)
  const [position, setPosition] = useState({ x: 120, y: 70 })
  const gesture = useRef<{ x: number; y: number; left: number; top: number; width: number; height?: number; resize?: boolean } | null>(null)

  /** Saves width. */
  const saveWidth = (value: number) => {
    setWidth(value)
    localStorage.setItem("vessel-transit-width", String(value))
  }

  /** Moves move. */
  const move = (event: React.PointerEvent<HTMLElement>) => {
    const start = gesture.current
    if (!start) return
    if (start.resize) {
      if (vertical) setHeight(Math.max(180, Math.min(window.innerHeight - 60, (start.height || height) + (event.clientY - start.y) * (dock === "top" ? 1 : -1))))
      else saveWidth(Math.max(320, Math.min(dock === "floating" ? window.innerWidth - position.x : Math.min(900, window.innerWidth - (activityCollapsed ? 0 : 52)), start.width + (event.clientX - start.x) * (dock === "right" ? -1 : 1))))
    }
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
        <div className="ml-auto flex items-center">
          <button type="button" data-title="导入文件" data-title-side="bottom" aria-label="导入文件" disabled={adding} onClick={() => void importFiles()} className="transit-bar-item"><Upload /></button>
          <button type="button" data-title="读取剪贴板" data-title-side="bottom" aria-label="读取剪贴板" disabled={adding} onClick={() => void readClipboard()} className="transit-bar-item"><ClipboardPaste /></button>
          <button data-title={full ? "还原" : "展开"} aria-label={full ? "还原" : "展开"} onClick={() => setFull(!full)} className="transit-bar-item"><i aria-hidden="true" className={`codicon codicon-screen-${full ? "normal" : "full"}`} /></button>
          <button data-title="独立窗口" aria-label="独立窗口" onClick={() => void window.electronAPI.openTransitWindow(item, items.filter((entry) => entry.kind === "file" && entry.root).map((entry) => ({ root: entry.root!, content: entry.content }))).catch((error) => toast.error(String(error)))} className="transit-bar-item"><i aria-hidden="true" className="codicon codicon-link-external" /></button>
          <TransitDock value={dock} onChange={changeDock} />
          <button
            type="button"
            className="transit-bar-item"
            aria-label={tabsVisible ? "隐藏中转站标签栏" : "显示中转站标签栏"}
            data-title={tabsVisible ? "隐藏标签栏" : "显示标签栏"}
            aria-pressed={tabsVisible}
            onClick={() => {
              const next = !tabsVisible
              setTabsVisible(next)
              localStorage.setItem("vessel-transit-tabs-visible", String(next))
            }}
          >{tabsVisible ? <PanelTopClose /> : <PanelTopOpen />}</button>
          <button type="button" className="transit-bar-item" aria-label={statusVisible ? "隐藏底部状态栏" : "显示底部状态栏"} data-title={statusVisible ? "隐藏底部状态栏" : "显示底部状态栏"} aria-pressed={statusVisible} onClick={() => { const next = !statusVisible; setStatusVisible(next); localStorage.setItem("vessel-transit-status-visible", String(next)) }}>{statusVisible ? <PanelBottomClose /> : <PanelBottomOpen />}</button>
        </div>
        <button data-title="关闭" aria-label="关闭中转站" onClick={() => selectTransit(null)} className="transit-bar-item transit-close"><i aria-hidden="true" className="codicon codicon-chrome-close" /></button>
      </header>
      {tabsVisible && items.length > 1 && <nav aria-label="中转项轮播" className="transit-bar transit-strip-bar">
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
      </nav>}
      <div className="transit-sheet-body">
      {item.kind === "file" ? (
        <Suspense fallback={<div role="status">正在加载文件预览…</div>}>
          <FilePreview key={`${item.id}-${refresh}`} item={item} onLoaded={onLoaded} imageDetailsHidden={imageDetailsHidden[item.id]} onImageDetailsHiddenChange={(hidden) => setImageDetailsHidden((current) => ({ ...current, [item.id]: hidden }))} />
        </Suspense>
      ) : item.kind === "url" ? (
        <WebPreview
          searchRequest={searchRequest}
          key={`${item.id}-${refresh}`}
          item={item}
        />
      ) : (
        <TransitTextPreview key={item.id} content={item.content} />
      )}
      </div>
      <TransitStatus visible={statusVisible} item={item} file={loaded?.id === item.id ? loaded.file : undefined} onSearch={() => setSearchRequest((value) => value + 1)} onRefresh={() => setRefresh((value) => value + 1)} />
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
        data-transit-container
        showOverlay={false}
        showCloseButton={false}
        side="right"
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ left: activityCollapsed ? 0 : 52, width: activityCollapsed ? "100vw" : "calc(100vw - 52px)", top: 0, height: "100dvh" }}
        className="z-[240] pointer-events-none [&_.vessel-panel-separator]:pointer-events-auto !max-w-none border-0 bg-transparent p-0 shadow-none"
      >
        {/* Keep the preview at the same DOM location across dock/fullscreen changes. */}
        <div
          data-transit-surface={full ? "full" : dock}
          className={`transit-sheet pointer-events-auto absolute flex min-h-0 min-w-0 flex-col ${dock === "floating" && !full ? "overflow-hidden rounded-xl border shadow-xl" : "shadow-lg"}`}
          style={full ? { inset: 0 } : dock === "floating"
            ? { left: Math.max(0, position.x - (activityCollapsed ? 0 : 52)), top: position.y, height: "80vh", width: Math.min(width, window.innerWidth - (activityCollapsed ? 0 : 52)) }
            : vertical ? { [dock === "top" ? "top" : "bottom"]: 0, left: 0, right: 0, height }
            : { top: 0, bottom: 0, [left ? "left" : "right"]: 0, width: Math.min(width, window.innerWidth - (activityCollapsed ? 0 : 52)) }}
        >
          {content}
          <div
            role="separator"
            tabIndex={full ? -1 : 0}
            aria-hidden={full}
            aria-label={dock === "floating" ? "调整悬浮面板宽度" : vertical ? "调整中转站高度" : "调整中转站宽度"}
            aria-orientation={vertical ? "horizontal" : "vertical"}
            aria-valuemin={vertical ? 180 : 320}
            aria-valuenow={vertical ? height : width}
            className={`vessel-panel-separator absolute touch-none ${full ? "hidden" : vertical ? `inset-x-0 h-1 cursor-row-resize ${dock === "top" ? "bottom-0" : "top-0"}` : `inset-y-0 w-1 cursor-col-resize ${dock === "right" ? "left-0" : "right-0"}`}`}
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              gesture.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y, width, height, resize: true }
            }}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerCancel={stop}
            onKeyDown={(event) => {
              if (vertical && ["ArrowUp", "ArrowDown"].includes(event.key)) {
                event.preventDefault()
                setHeight(value => Math.max(180, Math.min(window.innerHeight - 60, value + (event.key === "ArrowDown" ? 10 : -10) * (dock === "top" ? 1 : -1))))
              } else if (!vertical && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
                event.preventDefault()
                saveWidth(Math.max(320, Math.min(dock === "floating" ? window.innerWidth - position.x : Math.min(900, window.innerWidth - (activityCollapsed ? 0 : 52)), width + (event.key === "ArrowRight" ? 10 : -10) * (dock === "right" ? -1 : 1))))
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
