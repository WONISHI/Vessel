import { PageToolsMenu } from "./page-tools-menu"
import { pageTransitionKey, transitionPage } from "@/lib/page-transition"
import "@vscode/codicons/dist/codicon.css"
import { FeaturePageOverlay } from "./feature-page-overlay"
import { ActivityMenu } from "./activity-menu"
import { useActivityBarCollapsed } from "@/features/activity-bar/collapse"
import { layoutScopeForPath } from "@/features/layout/visibility-scope"
import { browserURL } from "@/pages/browser/url"
import { toast } from "@/components/ui/sonner"
import { bindDoubleSpace } from "../../../../shared/double-space"
import { useLocation, useNavigate } from "react-router-dom"
import { useState, useRef, useEffect, useLayoutEffect, useCallback, type CSSProperties } from "react"
import { ArrowLeft, ArrowRight, CalendarDays, House, Plus, Search, Network, X } from "lucide-react"
import { titlebarPage } from "./titlebar-page"
import { BrowserFavicon } from "@/components/browser-favicon"
import "./top-search.css"
import { WorkspaceFilePicker } from "@/components/workspace-file-picker"
import type { FilePickerRequest, FilePickerWorkspace } from "@/components/workspace-file-picker/types"
import { useBrowserTabs, selectBrowserTab, browserTabAction } from "@/pages/browser/tab-state"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { QuickPickerScrollArea } from "@/components/workspace-file-picker/quick-picker-scroll-area"
import { QuickPickerFooter } from "@/components/workspace-file-picker/quick-picker-footer"
import { TransitButton } from "@/components/transit/button"
import { StatusClock } from "@/components/ui/status-clock"
import { useStatusBarVisible } from "@/features/status-bar/visibility"
import { LayoutVisibilityControls } from "./layout-visibility-controls"

/** Shared quick-open entry remains part of the page in native full screen. */
export function TopSearch() {
  const location = useLocation()
  const { pathname } = location
  const navigate = useNavigate()
  const [overlay, setOverlay] = useState<{ kind: "todos" | "devtools"; locationKey: string } | null>(null)
  const [overlayTool, setOverlayTool] = useState("json")
  if (overlay && overlay.locationKey !== location.key) setOverlay(null)
  const overlayKind = overlay?.locationKey === location.key ? overlay.kind : null
  const displayPath = overlayKind === "todos" ? "/todos" : overlayKind === "devtools" ? `/devtools/${overlayTool}` : pathname
  const layoutScope = layoutScopeForPath(displayPath)
  const featureReturnTo = useRef("/editor")
  useLayoutEffect(() => {
    if (!layoutScope) featureReturnTo.current = location.pathname + location.search + location.hash
  }, [layoutScope, location.pathname, location.search, location.hash])
  const closeOverlay = () => { void transitionPage(() => setOverlay(null), pageTransitionKey(pathname)) }
  const closeFeature = () => { if (layoutScope === "graph") window.dispatchEvent(new Event("vessel:graph-close")); if (overlayKind) closeOverlay(); else void navigate(featureReturnTo.current) }
  const featureName = layoutScope === "graph" ? "关系图谱" : layoutScope === "todos" ? "待办" : "开发工具"
  const openFeature = (path: string) => {
    if (path === "/todos" || path === "/devtools") {
      setOpen(false)
      const kind = path === "/todos" ? "todos" : "devtools"
      void transitionPage(() => setOverlay({ kind, locationKey: location.key }), kind === "todos" ? "feature:todos" : `feature:devtools:${overlayTool}`)
    } else void navigate(path)
  }
  const statusVisible = useStatusBarVisible()
  const activityCollapsed = useActivityBarCollapsed()
  const workspacePage = /^\/editor(\/|$)/.test(displayPath)
  const showLayoutControls = !/^\/(settings|debug)(\/|$)/.test(displayPath)
  const showPageTools = !statusVisible && !layoutScope && /^\/(editor|resources|browser)(\/|$)/.test(displayPath)
  const page = titlebarPage(displayPath)
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
  const searchable = !overlayKind && /^\/(editor|resources|browser)(\/|$)/.test(pathname)
  const browser = pathname.startsWith("/browser")
  const scope: "resources" | "workspace" = pathname.startsWith("/resources") ? "resources" : "workspace"
  const activeBrowserIndex = tabs.findIndex(tab => tab.active)
  const switchTab = (direction: -1 | 1) => {
    if (browser) {
      const target = activeBrowserIndex >= 0 ? tabs[activeBrowserIndex + direction] : undefined
      if (target) selectBrowserTab(target.id)
      return
    }
    let root: string | undefined
    try { root = JSON.parse(localStorage.getItem(scope === "resources" ? "resource_current_project" : "app_current_workspace") || "null")?.path } catch { /* Use the active controller when no saved root is available. */ }
    const provide: FilePickerRequest = Object.assign((value: FilePickerWorkspace) => {
      if (root && value.root !== root) return
      let pinned: string[] = []
      try { const saved = JSON.parse(localStorage.getItem("vessel-pinned-tabs") || "[]"); if (Array.isArray(saved)) pinned = saved } catch { /* Default to tab order. */ }
      const files = [...value.files].sort((a, b) => Number(pinned.includes(b.path)) - Number(pinned.includes(a.path)))
      const index = files.findIndex(file => file.path === value.activePath)
      const target = files[index + direction]
      if (target) value.openFile(target)
    }, { scope })
    window.dispatchEvent(new CustomEvent("vessel:request-workspace-files", { detail: provide }))
  }
  const show = useCallback(() => {
    if (open) {
      document.querySelector<HTMLInputElement>(".vessel-quick-picker input, .workspace-file-picker input")?.focus({ preventScroll: true })
      return
    }
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
  }, [browser, scope, open])
  useEffect(() => {
    if (!searchable) return
    const stop = bindDoubleSpace(window, show, { allowButtons: open })
    const fromGuest = (event: Event) => {
      if (browser && tabs.some((tab) => tab.active && tab.id === (event as CustomEvent<string>).detail)) show()
    }
    window.addEventListener("vessel-browser-open-top-search", fromGuest)
    return () => { stop(); window.removeEventListener("vessel-browser-open-top-search", fromGuest) }
  }, [searchable, browser, tabs, show, open])
  const matching = tabs.filter((tab) => `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <>
    <header data-page-tools={showPageTools ? "true" : undefined} data-activity-menu={activityCollapsed ? "true" : undefined} data-feature-view={layoutScope ? "true" : undefined} data-workspace={workspacePage ? "true" : undefined} data-titlebar-clock={!statusVisible ? "true" : undefined} style={{ WebkitAppRegion: "drag" } as CSSProperties} className="vessel-main-titlebar fixed inset-x-0 top-0 z-40 flex h-9 shrink-0 items-center justify-center gap-2 border-b bg-white px-3 text-xs text-stone-500 dark:bg-[#22272e]">
      <span style={{ left: 100, transform: `translateX(${fullscreen ? -86 : 0}px)` }} className="vessel-titlebar-identity pointer-events-none absolute flex max-w-[180px] items-center gap-2 truncate font-semibold"><PageIcon className="size-4 shrink-0 text-emerald-600" />{page.label}</span>
      {searchable && <div style={{ WebkitAppRegion: "no-drag" } as CSSProperties} className="vessel-titlebar-search flex min-w-0 items-center gap-2">
      <button type="button" aria-label="上一个标签页" data-title="上一个标签页" disabled={browser && activeBrowserIndex <= 0} className="rounded p-1 hover:bg-stone-200 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/10" onClick={() => switchTab(-1)}><ArrowLeft className="size-3.5" /></button>
      <button type="button" aria-label="下一个标签页" data-title="下一个标签页" disabled={browser && (activeBrowserIndex < 0 || activeBrowserIndex >= tabs.length - 1)} className="rounded p-1 hover:bg-stone-200 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/10" onClick={() => switchTab(1)}><ArrowRight className="size-3.5" /></button>
      <button ref={anchor} type="button" aria-label={browser ? "搜索浏览器标签" : "搜索文件和已打开标签"} onClick={show} className="flex h-6 min-w-0 flex-1 items-center justify-center gap-2 rounded-md border bg-white px-3 dark:bg-white/5">
        <Search className="size-3.5" /><span className="truncate">{browser ? "搜索标签名称或网址…" : "搜索文件、路径和已打开标签…"}</span>
      </button>
      </div>}
      <div style={{ WebkitAppRegion: "no-drag" } as CSSProperties} className="vessel-titlebar-actions absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {!statusVisible && <StatusClock className="vessel-titlebar-clock" />}
        {workspacePage && <button type="button" aria-label="查看关系图谱" data-title="查看关系图谱" className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-white/10" aria-pressed={pathname === "/editor/graph"} onClick={() => openFeature("/editor/graph")}>
          <Network className="size-4" />
        </button>}
        <button type="button" aria-label="待办" data-title="待办" aria-pressed={displayPath.startsWith("/todos")} className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-white/10" onClick={() => openFeature("/todos")}>
          <CalendarDays className="size-4" />
        </button>
        <TransitButton />
        <button type="button" aria-label="开发工具" data-title="开发工具" aria-pressed={displayPath.startsWith("/devtools")} className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-white/10" onClick={() => openFeature("/devtools")}>
          <i aria-hidden="true" className="codicon codicon-developer-tools !text-base" />
        </button>
        {/^\/debug(\/|$)/.test(displayPath) && <button type="button" aria-label="回到首页" data-title="回到首页" className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-white/10" onClick={() => { void navigate("/") }}>
          <House className="size-4" />
        </button>}
        {showPageTools && <PageToolsMenu browser={browser} />}
        {activityCollapsed && <ActivityMenu />}
        {showLayoutControls && <LayoutVisibilityControls />}
        {layoutScope && <button type="button" aria-label={`关闭${featureName}`} data-title="关闭" className="flex size-6 items-center justify-center rounded text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:bg-red-50 focus-visible:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400" onClick={closeFeature}><X className="size-4" /></button>}
      </div>
    </header>
    <FeaturePageOverlay feature={overlayKind} tool={overlayTool} onToolChange={setOverlayTool} onClose={closeOverlay} />
    {open && !browser && <WorkspaceFilePicker workspace={workspace} popupStyle={popupStyle} onClose={() => setOpen(false)} />}
    <Dialog modal={false} open={open && browser} onOpenChange={setOpen}>
      <DialogContent style={popupStyle} className="vessel-quick-picker z-[282] translate-y-0" showCloseButton={false}>
        <DialogTitle className="sr-only">搜索浏览器标签</DialogTitle><DialogDescription className="sr-only">按标题或网址查找已打开的标签页</DialogDescription>
        <div className="quick-picker-input"><Search aria-hidden className="size-3.5 shrink-0" /><input autoFocus aria-label="标签名称或网址" placeholder="按名称或网址搜索标签…" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0) }} onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setSelected((value) => Math.max(0, Math.min(matching.length - 1, value + (event.key === "ArrowDown" ? 1 : -1)))) }
          if (event.key === "Enter" && matching[selected]) { event.preventDefault(); selectBrowserTab(matching[selected].id); setOpen(false) }
        }} />{query ? <button type="button" aria-label="清空搜索" data-title="清空搜索" onClick={() => { setQuery(""); setSelected(0) }}><X className="size-3.5" /></button> : <kbd>esc</kbd>}{query.trim() && <button type="button" aria-label="新增标签页" data-title="在当前标签右侧打开" onClick={() => {
          setOpen(false)
          try { browserTabAction("new", undefined, browserURL(query)) }
          catch (error) { toast.error(String(error)) }
        }}><Plus className="size-4" /></button>}</div>
        <div className="quick-picker-section"><span>打开的标签页</span><span>{matching.length} 个结果</span></div>
        <QuickPickerScrollArea viewportRef={resultsViewport} className="quick-picker-results"><div role="listbox" aria-label="搜索结果">{matching.map((tab, index) => <button role="option" aria-selected={index === selected} type="button" key={tab.id} className="quick-picker-row" onClick={() => { selectBrowserTab(tab.id); setOpen(false) }}>
          <span className="quick-picker-icon"><BrowserFavicon url={tab.url} favicon={tab.favicon} frozen={tab.frozen} /></span>
          <span className="quick-picker-copy"><span className="quick-picker-title">{tab.title || "未命名标签"}</span><span className="quick-picker-url">{tab.url}</span></span>
          {tab.active && <span className="quick-picker-current">当前标签</span>}
        </button>)}{!matching.length && <p className="quick-picker-empty">没有匹配的标签，试试其他关键词</p>}</div></QuickPickerScrollArea>
        <QuickPickerFooter action="切换标签" />
      </DialogContent>
    </Dialog>
  </>
}
