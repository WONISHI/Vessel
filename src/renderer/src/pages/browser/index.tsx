import { matchesShortcut } from "@vessel/utils"
import { StatusBar } from "@/components/ui/status-bar"
import { HistoryInput } from "./history-input"
import { BrowserProxy } from "./proxy"
import { BookmarkBar } from './bookmark-bar'
import { TabSwitcher } from "@/components/tab-switcher"
import { publishBrowserTabs } from "./tab-state"
import { BrowserMore, DeviceToolbar } from "./tools"
import { ResizableSplit } from "@/components/ui/resizable-split"
import { addTransit } from "@/components/transit/state"
import browserLoading from "@/assets/vessel-browser-loading/loading.svg"
import { BrowserExtensions } from "./extensions"
import { markGuestReady, withGuest } from "./guest-lifecycle"
import { pageObserverScript } from "./page-observer"
import { elementPickerScript } from "./element-picker"
import { webviewAttributes } from "./webview-attributes"
import { memo, useCallback, useEffect, useRef, useState } from "react"
import type { WebviewTag } from "electron"
import { ChevronUp, ChevronDown, ChevronRight, ArrowLeft, ArrowRight, RotateCw, Home, Globe, Plus, X, Search, LockKeyhole, Bookmark, Bug, SquareDashedMousePointer, Pin, Link2, ZoomIn } from "lucide-react"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useRouter } from "@vessel/react-router"
import Layout from "@/layout"
import ActivityBar from "@/layout/activity-bar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { browserURL } from "./url"
import "./index.css"

type Tab = { ready?: boolean; openerId?: string; favicon?: string; id: string; url: string; title: string; loading: boolean; back: boolean; forward: boolean; error: string; zoom: number; pinned?: boolean }
const newTab = (): Tab => ({ id: crypto.randomUUID(), url: "", title: "新标签页", loading: false, back: false, forward: false, error: "", zoom: 1 })
export type BookmarkItem = { title: string; url: string; favicon?: string }
const BROWSER_TABS_KEY = "browser-tabs"
const BROWSER_ACTIVE_TAB_KEY = "browser-active-tab"

type SavedBrowserTab = {
  id: string
  url: string
  title: string
  favicon?: string
  pinned?: boolean
  openerId?: string
  zoom?: number
}

function loadSavedBrowserTabs(): { tabs: Tab[]; activeId: string } {
  try {
    const raw = localStorage.getItem(BROWSER_TABS_KEY)
    const savedActiveId = localStorage.getItem(BROWSER_ACTIVE_TAB_KEY) || ""
    if (raw) {
      const parsed = JSON.parse(raw) as SavedBrowserTab[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        const restored: Tab[] = parsed
          .filter((item): item is SavedBrowserTab => Boolean(item && typeof item.id === "string" && typeof item.url === "string"))
          .map((item) => ({
            id: item.id,
            url: item.url,
            title: item.title || (item.url ? "正在加载…" : "新标签页"),
            favicon: item.favicon,
            pinned: Boolean(item.pinned),
            openerId: item.openerId,
            loading: Boolean(item.url),
            ready: false,
            back: false,
            forward: false,
            error: "",
            zoom: typeof item.zoom === "number" ? item.zoom : 1
          }))
        if (restored.length > 0) {
          const activeId = restored.some((t) => t.id === savedActiveId) ? savedActiveId : restored[0].id
          return { tabs: restored, activeId }
        }
      }
    }
  } catch (error) {
    console.error("Failed to restore browser tabs:", error)
  }
  const defaultTab = newTab()
  return { tabs: [defaultTab], activeId: defaultTab.id }
}
const shortcuts: BookmarkItem[] = [
  { title: "GitHub", url: "https://github.com", favicon: "https://github.githubassets.com/favicons/favicon.svg" },
  { title: "StackOverflow", url: "https://stackoverflow.com", favicon: "https://stackoverflow.com/favicon.ico" },
  { title: "MDN Docs", url: "https://developer.mozilla.org", favicon: "https://developer.mozilla.org/favicon-48x48.png" },
  { title: "React", url: "https://react.dev", favicon: "https://react.dev/favicon.ico" },
  { title: "稀土掘金", url: "https://juejin.cn", favicon: "https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/static/favicons/favicon-32x32.png" }
]
const Guest = memo(function Guest({ tab, visible, register, update }: { tab: Tab; visible: boolean; register: (id: string, view: WebviewTag | null) => void; update: (id: string, patch: Partial<Tab>) => void }) {
  const ref = useRef<WebviewTag | null>(null)
  const [initialURL] = useState(tab.url)
  const updateRef = useRef(update)
  useEffect(() => {
    updateRef.current = update
  }, [update])
  useEffect(() => {
    const view = ref.current
    if (!view) return
    const sync = () => withGuest(view, guest => updateRef.current(tab.id, { url: guest.getURL(), title: guest.getTitle() || "正在加载…", back: guest.canGoBack(), forward: guest.canGoForward() }))
    const onReady = () => {
      void view.executeJavaScript(pageObserverScript).catch(error => console.warn("页面监听注入失败", error))
      markGuestReady(view, true)
      if (tab.zoom && tab.zoom !== 1) {
        try { view.setZoomFactor(tab.zoom) } catch {}
      }
      sync()
      updateRef.current(tab.id, { loading: false, ready: true })
    }
    const start = (event: Electron.DidStartNavigationEvent) => { if (event.isMainFrame && !event.isInPlace) updateRef.current(tab.id, { loading: true, error: "" }) }
    const stop = () => {
      sync()
      updateRef.current(tab.id, { loading: false })
    }
    const favicon = (event: Electron.PageFaviconUpdatedEvent) => {
      const url = event.favicons.find(value => /^https?:\/\//i.test(value) || /^data:image\//i.test(value))
      updateRef.current(tab.id, { favicon: url })
    }
    const fail = (event: Electron.DidFailLoadEvent) => {
      if (event.isMainFrame && event.errorCode !== -3) updateRef.current(tab.id, { loading: false, error: `页面加载失败：${event.errorDescription}` })
    }
    const message = (event: Electron.IpcMessageEvent) => {
      if (event.channel === "vessel-focus" || event.channel === "vessel-search-handled") {
        const value = event.args[0]
        if (typeof value === "boolean") view.dataset[event.channel === "vessel-focus" ? "inputFocused" : "pageHandlesSearch"] = String(value)
      }
      if (event.channel === "vessel-navigation") sync()
      if (event.channel === "vessel-find") window.dispatchEvent(new CustomEvent("vessel-browser-find", { detail: view.getWebContentsId() }))
    }
    view.addEventListener("ipc-message", message)
    view.addEventListener("page-favicon-updated", favicon)
    view.addEventListener("dom-ready", onReady)
    view.addEventListener("did-navigate", sync)
    view.addEventListener("did-navigate-in-page", sync)
    view.addEventListener("page-title-updated", sync)
    view.addEventListener("did-start-navigation", start)
    view.addEventListener("did-stop-loading", stop)
    view.addEventListener("did-fail-load", fail)
    return () => {
      view.removeEventListener("ipc-message", message)
      markGuestReady(view, false)
      view.removeEventListener("page-favicon-updated", favicon)
      view.removeEventListener("dom-ready", onReady)
      view.removeEventListener("did-navigate", sync)
      view.removeEventListener("did-navigate-in-page", sync)
      view.removeEventListener("page-title-updated", sync)
      view.removeEventListener("did-start-navigation", start)
      view.removeEventListener("did-stop-loading", stop)
      view.removeEventListener("did-fail-load", fail)
    }
  }, [tab.id])
  return <webview
    ref={useCallback((view: WebviewTag | null) => { ref.current = view; register(tab.id, view) }, [register, tab.id])}
    src={initialURL}
    {...webviewAttributes}
    style={{ width: "100%", height: "100%", display: visible ? "flex" : "none" }}
  />
})
export default function BrowserPage({ visible = true }: { visible?: boolean }) {
  const router = useRouter()
  const [deviceViewport, setDeviceViewport] = useState({ width: 390, height: 844, scale: 1 })
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [deviceMode, setDeviceMode] = useState(false)
  const initialTabsState = useRef<ReturnType<typeof loadSavedBrowserTabs> | null>(null)
  if (!initialTabsState.current) {
    initialTabsState.current = loadSavedBrowserTabs()
  }
  const [tabs, setTabs] = useState<Tab[]>(() => initialTabsState.current!.tabs)
  const [findOpen, setFindOpen] = useState(false)
  const [matchCase, setMatchCase] = useState(false)
  const [findText, setFindText] = useState("")
  const [findResult, setFindResult] = useState({ activeMatchOrdinal: 0, matches: 0, tabId: "", text: "" })
  const findInput = useRef<HTMLInputElement>(null)
  const [findPosition, setFindPosition] = useState<{ x: number; y: number } | null>(null)
  const findDrag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  useEffect(() => {
    const stop = () => { findDrag.current = null; document.body.classList.remove("vessel-find-dragging") }
    window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop); window.addEventListener("blur", stop)
    return () => { stop(); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); window.removeEventListener("blur", stop) }
  }, [])
  const [consoleWidth, setConsoleWidth] = useState(() => Number(localStorage.getItem("browser-console-width")) || 440)
  const [consoleHeight, setConsoleHeight] = useState(() => Number(localStorage.getItem("browser-console-height")) || 300)
  const [devtoolsOpen, setDevtoolsOpen] = useState(false)
  const [dock, setDock] = useState(() => localStorage.getItem("browser-devtools-dock") || "bottom")
  const [consoleFont, setConsoleFont] = useState(() => localStorage.getItem("browser-devtools-font") || "Menlo")
  const [consoleSize, setConsoleSize] = useState(() => Number(localStorage.getItem("browser-devtools-size")) || 13)
  useEffect(() => {
    localStorage.setItem("browser-devtools-dock", dock)
    localStorage.setItem("browser-devtools-font", consoleFont)
    localStorage.setItem("browser-devtools-size", String(consoleSize))
  }, [dock, consoleFont, consoleSize])
  useEffect(() => window.electronAPI.onBrowserDevtoolsClosed(() => setDevtoolsOpen(false)), [])
  const devtoolsHost = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string>(() => initialTabsState.current!.activeId)
  useEffect(() => {
    const open = () => {
      if (!visible) return
      const url = sessionStorage.getItem('vessel-browser-pending-url')
      if (!url) return
      sessionStorage.removeItem('vessel-browser-pending-url')
      if (!/^(file|https?):\/\//i.test(url)) return
      const item = { ...newTab(), url, loading: true }
      setTabs(current => [...current, item]); setActive(item.id)
    }
    open()
    window.addEventListener('vessel-browser-open-url', open)
    return () => window.removeEventListener('vessel-browser-open-url', open)
  }, [visible])
  const [input, setInput] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem("browser-bookmarks") || "null") as typeof shortcuts) || shortcuts
    } catch {
      return shortcuts
    }
  })
  useEffect(() => { void window.electronAPI.syncBrowserBookmarks(bookmarks).catch(console.error) }, [bookmarks])
  const views = useRef(new Map<string, WebviewTag>())
  const registerView = useCallback((id: string, view: WebviewTag | null) => {
    if (view) views.current.set(id, view)
    else views.current.delete(id)
  }, [])
  const tab = tabs.find((item) => item.id === active) || tabs[0]
  useEffect(() => { publishBrowserTabs(tabs.filter(item => Boolean(item.url)).map(item => ({ id: item.id, title: item.title, url: item.url, favicon: item.favicon, active: item.id === tab.id }))) }, [tabs, tab.id])
  useEffect(() => {
    try {
      const savedTabs: SavedBrowserTab[] = tabs.map(t => ({
        id: t.id,
        url: t.url,
        title: t.title,
        favicon: t.favicon,
        pinned: t.pinned,
        openerId: t.openerId,
        zoom: t.zoom
      }))
      localStorage.setItem(BROWSER_TABS_KEY, JSON.stringify(savedTabs))
      localStorage.setItem(BROWSER_ACTIVE_TAB_KEY, tab.id)
    } catch (error) {
      console.error("Failed to save browser tabs:", error)
    }
  }, [tabs, tab.id])
  useEffect(() => {
    const select = (event: Event) => { setActive((event as CustomEvent<string>).detail); setInput(null) }
    window.addEventListener("vessel-browser-tab", select)
    return () => window.removeEventListener("vessel-browser-tab", select)
  }, [])
  const searchPage = (forward = true, next = false) => {
    const view = views.current.get(tab.id)
    if (findText) withGuest(view, guest => guest.findInPage(findText, { forward, findNext: next, matchCase }))
    else withGuest(view, guest => guest.stopFindInPage("clearSelection"))
  }
  useEffect(() => {
    if (!visible) return
    const show = () => { setFindOpen(true); requestAnimationFrame(() => { findInput.current?.focus(); findInput.current?.select() }) }
    const keydown = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && matchesShortcut(event, "find")) { event.preventDefault(); show() }
      if (matchesShortcut(event, "devtools")) { event.preventDefault(); setDevtoolsOpen(open => !open) }
      if (!event.defaultPrevented && matchesShortcut(event, "refreshBrowser")) { event.preventDefault(); if (!event.repeat) withGuest(views.current.get(tab.id), guest => guest.reload()) }
    }
    window.addEventListener("keydown", keydown)
    const pageFind = (event: Event) => { if (withGuest(views.current.get(tab.id), guest => guest.getWebContentsId()) === (event as CustomEvent<number>).detail) show() }
    window.addEventListener("vessel-browser-find", pageFind)
    const stopDevtools = window.electronAPI.onBrowserToggleDevtools?.(id => { if (withGuest(views.current.get(tab.id), guest => guest.getWebContentsId()) === id) setDevtoolsOpen(open => !open) })
    const unsubscribe = window.electronAPI.onBrowserFind(id => {
      if (withGuest(views.current.get(tab.id), guest => guest.getWebContentsId()) === id) show()
    })
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("vessel-browser-find", pageFind); stopDevtools?.(); unsubscribe() }
  }, [visible, tab.id])
  useEffect(() => {
    const view = views.current.get(tab.id)
    const result = (event: Electron.FoundInPageEvent) => setFindResult({ ...event.result, tabId: tab.id, text: findText })
    view?.addEventListener("found-in-page", result)
    const find = () => {
      if (findOpen && findText) withGuest(view, guest => guest.findInPage(findText, { matchCase }))
      else withGuest(view, guest => guest.stopFindInPage("clearSelection"))
    }
    view?.addEventListener("dom-ready", find)
    find()
    return () => { view?.removeEventListener("dom-ready", find); view?.removeEventListener("found-in-page", result); withGuest(view, guest => guest.stopFindInPage("clearSelection")) }
  }, [findText, findOpen, tab.id, matchCase])
  const update = useCallback((id: string, patch: Partial<Tab>) => setTabs(current => {
    const index = current.findIndex(item => item.id === id)
    if (index < 0 || (Object.keys(patch) as (keyof Tab)[]).every(key => current[index][key] === patch[key])) return current
    const next = [...current]; next[index] = { ...current[index], ...patch }; return next
  }), [])
  useEffect(() => {
    const element = devtoolsHost.current
    const view = views.current.get(tab.id)
    if (!visible || !devtoolsOpen || !element || !view) {
      void window.electronAPI.setBrowserDevtools(null).catch(() => {})
      return
    }
    let disposed = false
    const sync = () => {
      const { x, y, width, height } = element.getBoundingClientRect()
      try {
        void window.electronAPI.setBrowserDevtools(view.getWebContentsId(), { x, y, width, height }, { font: consoleFont, size: consoleSize, detached: dock === "detached" }).catch(error => {
          if (!disposed) { update(tab.id, { error: String(error) }); setDevtoolsOpen(false) }
        })
      } catch { /* guest 尚未完成挂载，dom-ready 后重试。 */ }
    }
    const observer = new ResizeObserver(sync)
    observer.observe(element)
    view.addEventListener("dom-ready", sync)
    window.addEventListener("resize", sync)
    sync()
    return () => {
      disposed = true
      observer.disconnect()
      view.removeEventListener("dom-ready", sync)
      window.removeEventListener("resize", sync)
      void window.electronAPI.setBrowserDevtools(null).catch(() => {})
    }
  }, [visible, devtoolsOpen, tab.id, Boolean(tab.url), dock, consoleFont, consoleSize])
  const navigate = (value: string) => {
    try {
      const url = browserURL(value)
      if (!url) return
      const view = views.current.get(tab.id)
      update(tab.id, { url, loading: true, error: "" })
      setInput(null)
      if (view) void view.loadURL(url).catch((error) => update(tab.id, { error: String(error), loading: false }))
    } catch (error) {
      update(tab.id, { error: String(error) })
    }
  }
  const add = () => {
    const item = newTab()
    setTabs((current) => [...current, item])
    setActive(item.id)
    setInput(null)
  }
  useEffect(() => window.electronAPI.onBrowserNewTab((url, opener) => {
    if (!/^(https?|chrome-extension|file):\/\//i.test(url)) return
    const item = { ...newTab(), url, loading: true, openerId: [...views.current.entries()].find(([, view]) => withGuest(view, guest => guest.getWebContentsId()) === opener)?.[0] }
    setTabs(current => [...current, item])
    setActive(item.id)
    setInput(null)
  }), [])
  const close = (id: string) => {
    const remaining = tabs.filter((item) => item.id !== id)
    if (!remaining.length) remaining.push(newTab())
    setTabs(remaining)
    if (tab.id === id) {
      setActive(remaining.find(item => item.id === tab.openerId)?.id || remaining[Math.max(0, tabs.findIndex(item => item.id === id) - 1)].id)
      setInput(null)
    }
  }
  const addTabRightOf = (targetId: string) => {
    const item = newTab()
    setTabs((current) => {
      const index = current.findIndex((t) => t.id === targetId)
      if (index < 0) return [...current, item]
      const next = [...current]
      next.splice(index + 1, 0, item)
      return next
    })
    setActive(item.id)
    setInput(null)
  }
  const reloadTab = (id: string) => {
    const view = views.current.get(id)
    withGuest(view, (guest) => guest.reload())
  }
  const togglePinTab = (id: string) => {
    setTabs((current) => current.map((t) => t.id === id ? { ...t, pinned: !t.pinned } : t))
  }
  const closeOtherTabs = (id: string) => {
    setTabs((current) => current.filter((t) => t.id === id || t.pinned))
    setActive(id)
    setInput(null)
  }
  const closeRightTabs = (id: string) => {
    setTabs((current) => {
      const index = current.findIndex((t) => t.id === id)
      if (index < 0) return current
      const remaining = current.filter((t, i) => i <= index || t.pinned)
      if (!remaining.some((t) => t.id === tab.id)) {
        setActive(id)
        setInput(null)
      }
      return remaining
    })
  }
  const [dragTabId, setDragTabId] = useState<string | null>(null)
  const reorderTabs = (sourceId: string, targetId: string) => {
    setTabs((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId)
      const targetIndex = current.findIndex((item) => item.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }
  useEffect(() => {
    const action = (event: Event) => { const detail = (event as CustomEvent<{ action: string; id: string }>).detail; if (detail.action === "new") add(); else if (detail.action === "close") close(detail.id) }
    window.addEventListener("vessel-browser-tab-action", action)
    return () => window.removeEventListener("vessel-browser-tab-action", action)
  })
  const zoom = (delta: number) => {
    const value = Math.max(0.5, Math.min(2, tab.zoom + delta))
    withGuest(views.current.get(tab.id), guest => guest.setZoomFactor(value))
    update(tab.id, { zoom: value })
  }
  const bookmark = () => {
    if (!tab.url) return
    const next = bookmarks.some((item) => item.url === tab.url) ? bookmarks.filter((item) => item.url !== tab.url) : [...bookmarks, { url: tab.url, title: tab.title, favicon: tab.favicon }]
    setBookmarks(next)
    localStorage.setItem("browser-bookmarks", JSON.stringify(next))
  }
  return (
    <Layout
      aside={
        <ActivityBar
          activity="browser"
          onActivityChange={(item) => {
            if (item !== "browser") void router.push(item === "tools" ? "/devtools" : item === "files" ? "/editor" : `/${item}`)
          }}
        />
      }
    >
      <main className="vessel-browser flex min-w-0 flex-1 flex-col overflow-hidden font-sans">
        <div className="browser-tabs">
          {tabs.map((item) => (
            <ContextMenu key={item.id}>
              <ContextMenuTrigger asChild>
                <div
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); setDragTabId(item.id) }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                  onDrop={(e) => { e.preventDefault(); const sourceId = e.dataTransfer.getData("text/plain") || dragTabId; if (sourceId && sourceId !== item.id) reorderTabs(sourceId, item.id) }}
                  onDragEnd={() => setDragTabId(null)}
                  className={`browser-tab ${item.id === tab.id ? "selected" : ""} ${item.pinned ? "pinned" : ""}`}
                >
                  <button
                    onClick={() => {
                      setActive(item.id)
                      setInput(null)
                    }}
                    className="browser-tab-select flex min-w-0 flex-1 items-center gap-2"
                    title={item.title}
                  >
                    {item.favicon ? <img src={item.favicon} alt="" className="size-4 shrink-0 object-contain" onError={() => update(item.id, { favicon: undefined })} /> : <Globe size={14} className="shrink-0 text-green-600" />}
                    {!item.pinned && <span className="truncate">{item.title}</span>}
                  </button>
                  {!item.pinned && (
                    <button
                      title="关闭标签页"
                      onClick={() => close(item.id)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem onSelect={() => addTabRightOf(item.id)}>
                  <Plus />在右侧新增标签页
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => reloadTab(item.id)}>
                  <RotateCw />重新加载
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => togglePinTab(item.id)}>
                  <Pin />{item.pinned ? "取消固定" : "固定"}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => close(item.id)}>
                  <X />关闭
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => closeOtherTabs(item.id)}>
                  关闭其他标签页
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => closeRightTabs(item.id)}>
                  关闭右侧标签页
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
          <div className="flex h-[var(--browser-tab-height)] w-[var(--browser-tab-height)] shrink-0 items-center justify-center">
            <TabSwitcher
              tabs={tabs.map(item => ({ ...item, active: item.id === tab.id }))}
              onSelect={id => { setActive(id); setInput(null) }}
            >
              <Button
                variant="ghost"
                size="icon"
                title="新标签页"
                className="h-[var(--browser-tab-height)] w-[var(--browser-tab-height)] rounded-t-lg rounded-b-none text-stone-500 hover:bg-stone-200"
                onClick={add}
              >
                <Plus className="size-4" />
              </Button>
            </TabSwitcher>
          </div>
        </div>
        <div className="relative shrink-0">

        <div hidden={toolbarCollapsed}>
        <div className="browser-toolbar">
          <Button
            variant="ghost"
            size="icon"
            title="后退"
            disabled={!tab.back}
            onClick={() => withGuest(views.current.get(tab.id), guest => guest.goBack())}
          >
            <ArrowLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="前进"
            disabled={!tab.forward}
            onClick={() => withGuest(views.current.get(tab.id), guest => guest.goForward())}
          >
            <ArrowRight />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={tab.loading ? "停止" : "刷新（F5）"}
            disabled={!tab.url}
            onClick={() => {
              const view = views.current.get(tab.id)
              if (tab.loading) withGuest(view, guest => guest.stop())
              else withGuest(view, guest => guest.reload())
            }}
          >
            {tab.loading ? <X /> : <RotateCw />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="首页"
            onClick={() => {
              update(tab.id, { ...newTab(), id: tab.id })
              setInput(null)
            }}
          >
            <Home />
          </Button>
          <form
            className="browser-address"
            onSubmit={(event) => {
              event.preventDefault()
              navigate(input ?? tab.url)
            }}
          >
            {tab.url.startsWith("https:") ? <LockKeyhole size={14} /> : <Search size={14} />}
            <HistoryInput onNavigate={(value, newWindow) => { if (newWindow) { const next = { ...newTab(), url: browserURL(value), loading: true }; setTabs(current => [...current, next]); setActive(next.id); setInput(null) } else navigate(value) }}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="none"
              aria-label="搜索或输入网址"
              placeholder="搜索或输入网址"
              value={input ?? tab.url}
              onChange={(event) => setInput(event.target.value)}
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              title="收藏当前页面"
              aria-label={bookmarks.some(item => item.url === tab.url) ? "取消书签" : "添加书签"}
              disabled={!tab.url}
              onClick={bookmark}
            >
              <Bookmark
                size={16}
                fill={bookmarks.some((item) => item.url === tab.url) ? "currentColor" : "none"}
              />
            </button>
          </form>
          <Button variant="ghost" size="icon" title="查看元素信息（Esc 退出，再次点击关闭）" aria-label="查看元素信息" disabled={!tab.url}
            onClick={() => { void withGuest(views.current.get(tab.id), guest => guest.executeJavaScript(elementPickerScript).catch(error => window.alert(`无法查看元素：${String(error)}`))) }}>
            <SquareDashedMousePointer />
          </Button>
          <Button variant="ghost" size="icon" aria-label="加入中转站" title="加入中转站" disabled={!tab.url} onClick={() => { try { addTransit(tab.url, tab.title) } catch (error) { window.alert(String(error)) } }}><Pin /></Button>
          <Button
            variant="ghost"
            size="icon"
            title="当前网页控制台"
            aria-label="打开当前网页控制台"
            disabled={!tab.url}
            aria-pressed={devtoolsOpen}
            onClick={() => setDevtoolsOpen(open => !open)}
          >
            <Bug />
          </Button>
          <BrowserExtensions onOpenDevtools={() => setDevtoolsOpen(true)} />
          <BrowserMore zoomFactor={tab.zoom} zoom={zoom} onFind={() => setFindOpen(true)} onNavigate={navigate} guest={() => views.current.get(tab.id)} deviceMode={deviceMode} onDevice={() => { setDeviceMode(value => !value) }} />
        </div>
        <BookmarkBar items={bookmarks} onNavigate={navigate} />
        </div></div>
        {deviceMode && <DeviceToolbar onViewport={setDeviceViewport} guest={() => views.current.get(tab.id)} tabId={tab.id} onClose={() => setDeviceMode(false)} />}
        <div className={`browser-content dock-${dock}`}>
        <ResizableSplit side={dock === 'detached' ? 'detached' : dock === 'left' ? 'left' : dock === 'right' ? 'right' : 'bottom'} size={dock === 'bottom' ? consoleHeight : consoleWidth} min={dock === 'bottom' ? 180 : 280} max={dock === 'bottom' ? window.innerHeight * .7 : window.innerWidth * .7} label={dock === 'bottom' ? '调整控制台高度' : '调整网页控制台宽度'} onResize={value => { if(dock === 'bottom') { setConsoleHeight(value); localStorage.setItem('browser-console-height', String(value)) } else { setConsoleWidth(value); localStorage.setItem('browser-console-width', String(value)) } }} pane={devtoolsOpen && tab.url ? (<section className="browser-devtools" style={{ height: dock === "detached" ? "auto" : "100%", width: "100%", minHeight: 0 }} aria-label="当前网页控制台">
          <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-1 text-xs text-stone-500">
            <span className="mr-auto">网页控制台</span>
            <select aria-label="控制台停靠位置" value={dock} onChange={event => setDock(event.target.value)}>
              <option value="bottom">底部停靠</option><option value="left">左侧停靠</option><option value="right">右侧停靠</option><option value="detached">独立窗口</option>
            </select>
            <select aria-label="控制台字体" value={consoleFont} onChange={event => setConsoleFont(event.target.value)}>
              {["Plus Jakarta Sans", "Menlo", "Consolas", "Courier New", "monospace", "system-ui"].map(font => <option key={font}>{font}</option>)}
            </select>
            <select aria-label="控制台字号（整体缩放）" title="字号（整体缩放）" value={consoleSize} onChange={event => setConsoleSize(Number(event.target.value))}>
              {[11, 12, 13, 14, 16, 18, 20].map(size => <option key={size} value={size}>{size}px</option>)}
            </select>
            <button aria-label="关闭网页控制台" onClick={() => setDevtoolsOpen(false)}><X size={14} /></button>
          </header>
          <div ref={devtoolsHost} className="min-h-0 flex-1" />
        </section>) : undefined}>

        <div className="relative h-full min-h-0 min-w-0 flex-1 bg-white">
          {findOpen && <form className="browser-find browser-find-bottom" style={findPosition ? { position: "fixed", left: findPosition.x, top: findPosition.y, right: "auto", bottom: "auto" } : undefined} onPointerDown={event => {
            if ((event.target as HTMLElement).closest("input, button") || event.button !== 0) return
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
            const rect = event.currentTarget.getBoundingClientRect()
            document.body.classList.add("vessel-find-dragging")
            findDrag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
          }} onPointerMove={event => {
            const start = findDrag.current; if (!start) return
            const rect = event.currentTarget.getBoundingClientRect()
            setFindPosition({ x: Math.max(0, Math.min(innerWidth - rect.width, start.left + event.clientX - start.x)), y: Math.max(0, Math.min(innerHeight - rect.height, start.top + event.clientY - start.y)) })
          }} onPointerUp={() => { findDrag.current = null; document.body.classList.remove("vessel-find-dragging") }} onPointerCancel={() => { findDrag.current = null; document.body.classList.remove("vessel-find-dragging") }} aria-label="网页查找" onSubmit={event => { event.preventDefault(); searchPage(true, true) }}>
            <Search size={15} className="text-stone-400" />
            <input ref={findInput} aria-label="在网页中查找" placeholder="在网页中查找" spellCheck={false} value={findText} onChange={event => setFindText(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setFindOpen(false); if (event.key === "Enter" && event.shiftKey) { event.preventDefault(); searchPage(false, true) } }} />
            <span className="browser-find-count">{findResult.tabId === tab.id && findResult.text === findText ? `${findResult.activeMatchOrdinal}/${findResult.matches}` : "0/0"}</span>
            <button type="button" aria-label="上一个匹配" disabled={!findText || !findResult.matches} onClick={() => searchPage(false, true)}><ChevronUp size={15} /></button>
            <button type="submit" aria-label="下一个匹配" disabled={!findText || !findResult.matches}><ChevronDown size={15} /></button>
            <span className="browser-find-divider" />
            <button type="button" aria-label="区分大小写" aria-pressed={matchCase} onClick={() => setMatchCase(value => !value)}>Aa</button>
            <button type="button" className="browser-find-close" aria-label="关闭查找" onClick={() => setFindOpen(false)}><X size={15} /></button>
          </form>}

          {tab.loading && !tab.ready && <div className="browser-page-loading" role="status" aria-label="正在加载页面">
            <div className="browser-loading-bar" />
            <div className="browser-loading-card"><img src={browserLoading} alt="" /><div>正在加载页面<span className="browser-loading-dots"><span>.</span><span>.</span><span>.</span></span></div><small title={tab.url}>{tab.url}</small></div>
          </div>}
          {tab.loading && tab.ready && <div className="pointer-events-none absolute inset-x-0 top-0 z-[150] h-1" role="status" aria-label="正在加载页面"><div className="browser-loading-bar" /></div>}
          <div className={deviceMode && tab.url ? "device-preview-surface absolute inset-0 overflow-auto p-7" : "absolute inset-0"}>
          <div style={deviceMode && tab.url ? { width: deviceViewport.width + 2, height: deviceViewport.height + 2, margin: "0 auto" } : { width: "100%", height: "100%" }}>
          <div aria-label={deviceMode ? "设备预览边框" : undefined} style={deviceMode && tab.url ? { width: deviceViewport.width, height: deviceViewport.height, boxSizing: "content-box", border: "1px solid #d6d3d1", borderRadius: 4, boxShadow: "0 8px 32px #0000001a, 0 2px 8px #0000000a", background: "white", overflow: "hidden" } : { width: "100%", height: "100%" }}>
          <div aria-label={deviceMode ? "设备预览内容" : undefined} style={deviceMode && tab.url ? { width: deviceViewport.width, height: deviceViewport.height, transform: `scale(${deviceViewport.scale})`, transformOrigin: "top left" } : { width: "100%", height: "100%" }}>
          {tabs
            .filter((item) => item.url)
            .map((item) => (
              <Guest
                key={item.id}
                tab={item}
                visible={item.id === tab.id}
                register={registerView}
                update={update}
              />
            ))}
          </div></div></div></div>
          {!tab.url && (
            <div className="browser-home">
              <div className="browser-logo">
                <Globe size={36} />
              </div>
              <h1>Vessel 浏览器</h1>
              <p>快速搜索或访问常用网站</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  navigate(searchInput)
                }}
              >
                <Search size={20} />
                <HistoryInput onNavigate={(value, newWindow) => { if (newWindow) { const next = { ...newTab(), url: browserURL(value), loading: true }; setTabs(current => [...current, next]); setActive(next.id); setInput(null) } else navigate(value) }}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="none"
                  aria-label="搜索"
                  placeholder="搜索或输入网址，按 Enter 访问"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </form>
              <div className="browser-shortcuts">
                {shortcuts.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => navigate(item.url)}
                  >
                    <span>{item.title[0]}</span>
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab.error && (
            <div
              role="alert"
              className="absolute inset-x-4 top-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {tab.error}
              <button
                className="ml-4 underline"
                onClick={() => navigate(tab.url)}
              >
                重试
              </button>
            </div>
          )}
        </div>

        </ResizableSplit></div>
      <StatusBar className="browser-shared-status" left={<>
        <button aria-label={toolbarCollapsed ? "展开浏览器工具栏" : "折叠浏览器工具栏"} aria-expanded={!toolbarCollapsed} onClick={() => setToolbarCollapsed(value => !value)} className="shrink-0 rounded p-1 hover:bg-stone-200">{toolbarCollapsed ? <ChevronUp size={13} /> : <ChevronRight size={13} />}</button>
        <button className="flex shrink-0 items-center gap-1 rounded px-2 py-1 hover:bg-stone-200" onClick={() => { setFindPosition(null); setFindOpen(true); requestAnimationFrame(() => findInput.current?.focus()) }}><Search size={13} />搜索</button>
        <span className="mx-1 h-4 border-l border-stone-300" />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex min-w-0 max-w-[360px] cursor-default items-center gap-1.5 px-1 font-['Plus_Jakarta_Sans',sans-serif] text-[11.5px] text-stone-500">
                <Link2 size={13} className="shrink-0" />
                <span className="truncate">{tab.loading ? "正在加载…" : tab.url || "就绪"}</span>
              </span>
            </TooltipTrigger>
            {tab.url ? (
              <TooltipContent side="top" sideOffset={6} className="max-w-[480px] break-all font-['Plus_Jakarta_Sans',sans-serif] text-xs">
                {tab.url}
              </TooltipContent>
            ) : null}
          </Tooltip>
        </TooltipProvider>
      </>} right={<BrowserProxy showLabel />} after={<button title="恢复 100% 缩放" aria-label="恢复页面缩放" className="ml-2 flex shrink-0 items-center gap-1 border-l border-stone-300 px-2 py-1 hover:bg-stone-200" onClick={() => zoom(1-tab.zoom)}><ZoomIn size={13} />{Math.round(tab.zoom*100)}%</button>} />
      </main>
    </Layout>
  )
}
