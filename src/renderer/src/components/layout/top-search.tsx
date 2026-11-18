import { useLocation } from "react-router-dom"
import { useState, useRef, useEffect, type CSSProperties } from "react"
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react"
import { titlebarPage } from "./titlebar-page"
import { BrowserFavicon } from "@/components/browser-favicon"
import "./top-search.css"
import { WorkspaceFilePicker } from "@/components/workspace-file-picker"
import type { FilePickerRequest, FilePickerWorkspace } from "@/components/workspace-file-picker/types"
import { useBrowserTabs, selectBrowserTab } from "@/pages/browser/tab-state"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { QuickPickerScrollArea } from "@/components/workspace-file-picker/quick-picker-scroll-area"
import { QuickPickerFooter } from "@/components/workspace-file-picker/quick-picker-footer"

/** Shared quick-open entry remains part of the page in native full screen. */
export function TopSearch() {
  const { pathname } = useLocation()
  const page = titlebarPage(pathname)
  const PageIcon = page.icon
  const tabs = useBrowserTabs()
  const [open, setOpen] = useState(false)
  const [workspace, setWorkspace] = useState<FilePickerWorkspace | null>(null)
  const [query, setQuery] = useState("")
  const anchor = useRef<HTMLButtonElement>(null)
  const resultsViewport = useRef<HTMLDivElement>(null)
  const [popupStyle, setPopupStyle] = useState<CSSProperties>()
  const [selected, setSelected] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    let alive = true
    let updated = false
    const off = window.electronAPI?.onWindowFullscreenChanged?.((value) => {
      updated = true
      if (alive) setFullscreen(value)
    })
    void window.electronAPI?.getWindowFullscreenState?.().then((value) => {
      if (alive && !updated) setFullscreen(value)
    }).catch(console.error)
    return () => { alive = false; off?.() }
  }, [])
  useEffect(() => {
    resultsViewport.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" })
  }, [selected])
  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener("resize", close)
    return () => window.removeEventListener("resize", close)
  }, [])
  const searchable = /^\/(editor|resources|browser)(\/|$)/.test(pathname)
  const browser = pathname.startsWith("/browser")
  const scope: "resources" | "workspace" = pathname.startsWith("/resources") ? "resources" : "workspace"
  const show = () => {
    const bounds = anchor.current?.getBoundingClientRect()
    if (bounds) setPopupStyle({ left: bounds.left, top: bounds.top, width: bounds.width, maxWidth: "calc(100vw - 16px)", transform: "none" })
    setSelected(0)
    setQuery("")
    setWorkspace(null)
    if (!browser) {
      const provide: FilePickerRequest = Object.assign((value: FilePickerWorkspace) => setWorkspace(value), { scope })
      window.dispatchEvent(new CustomEvent("vessel:request-workspace-files", { detail: provide }))
    }
    setOpen(true)
  }
  const matching = tabs.filter((tab) => `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <>
    <header style={{ WebkitAppRegion: "drag" } as CSSProperties} className="vessel-main-titlebar fixed inset-x-0 top-0 z-[100] flex h-9 shrink-0 items-center justify-center gap-2 border-b bg-white px-3 text-xs text-stone-500 dark:bg-[#22272e]">
      <span style={{ left: 100, transform: `translateX(${fullscreen ? -86 : 0}px)` }} className="vessel-titlebar-identity pointer-events-none absolute flex max-w-[180px] items-center gap-2 truncate font-semibold"><PageIcon className="size-4 shrink-0 text-emerald-600" />{page.label}</span>
      {searchable && <div style={{ WebkitAppRegion: "no-drag" } as CSSProperties} className="flex min-w-0 items-center gap-2 max-[700px]:ml-[180px]">
      <button type="button" aria-label="后退" className="rounded p-1 hover:bg-stone-200 dark:hover:bg-white/10" onClick={() => window.history.back()}><ArrowLeft className="size-3.5" /></button>
      <button type="button" aria-label="前进" className="rounded p-1 hover:bg-stone-200 dark:hover:bg-white/10" onClick={() => window.history.forward()}><ArrowRight className="size-3.5" /></button>
      <button ref={anchor} type="button" aria-label={browser ? "搜索浏览器标签" : "搜索文件和已打开标签"} onClick={show} className="flex h-6 w-[min(560px,65vw)] items-center justify-center gap-2 rounded-md border bg-white px-3 dark:bg-white/5">
        <Search className="size-3.5" /><span className="truncate">{browser ? "搜索标签名称或网址…" : "搜索文件、路径和已打开标签…"}</span>
      </button>
      </div>}
    </header>
    {open && !browser && <WorkspaceFilePicker workspace={workspace} popupStyle={popupStyle} onClose={() => setOpen(false)} />}
    <Dialog modal={false} open={open && browser} onOpenChange={setOpen}>
      <DialogContent style={popupStyle} className="vessel-quick-picker z-[282] translate-y-0" showCloseButton={false}>
        <DialogTitle className="sr-only">搜索浏览器标签</DialogTitle><DialogDescription className="sr-only">按标题或网址查找已打开的标签页</DialogDescription>
        <div className="quick-picker-input"><Search aria-hidden className="size-3.5 shrink-0" /><input autoFocus aria-label="标签名称或网址" placeholder="按名称或网址搜索标签…" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0) }} onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setSelected((value) => Math.max(0, Math.min(matching.length - 1, value + (event.key === "ArrowDown" ? 1 : -1)))) }
          if (event.key === "Enter" && matching[selected]) { event.preventDefault(); selectBrowserTab(matching[selected].id); setOpen(false) }
        }} />{query ? <button type="button" aria-label="清空搜索" onClick={() => { setQuery(""); setSelected(0) }}><X className="size-3.5" /></button> : <kbd>esc</kbd>}</div>
        <div className="quick-picker-section"><span>打开的标签页</span><span>{matching.length} 个结果</span></div>
        <QuickPickerScrollArea viewportRef={resultsViewport} className="quick-picker-results"><div role="listbox" aria-label="搜索结果">{matching.map((tab, index) => <button role="option" aria-selected={index === selected} type="button" key={tab.id} className="quick-picker-row" onClick={() => { selectBrowserTab(tab.id); setOpen(false) }}>
          <span className="quick-picker-icon"><BrowserFavicon url={tab.url} favicon={tab.favicon} /></span>
          <span className="quick-picker-copy"><span className="quick-picker-title">{tab.title || "未命名标签"}</span><span className="quick-picker-url">{tab.url}</span></span>
          {tab.active && <span className="quick-picker-current">当前标签</span>}
        </button>)}{!matching.length && <p className="quick-picker-empty">没有匹配的标签，试试其他关键词</p>}</div></QuickPickerScrollArea>
        <QuickPickerFooter action="切换标签" />
      </DialogContent>
    </Dialog>
  </>
}
