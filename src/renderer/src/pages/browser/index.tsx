import { TabSwitcher } from "@/components/tab-switcher"
import { publishBrowserTabs } from "./tab-state"
import { BrowserMore, DeviceToolbar } from "./tools"
import { ResizeEdge } from "@/components/ui/resize-edge"
import Clock from "react-live-clock"
import { addTransit } from "@/components/transit/state"
import browserLoading from "@/assets/vessel-browser-loading/loading.svg"
import { BrowserExtensions } from "./extensions"
import { markGuestReady, withGuest } from "./guest-lifecycle"
import { elementPickerScript } from "./element-picker"
import { webviewAttributes } from "./webview-attributes"
import { useEffect, useRef, useState } from "react"
import type { WebviewTag } from "electron"
import { ChevronUp, ChevronDown, ChevronRight, ArrowLeft, ArrowRight, RotateCw, Home, Globe, Plus, X, Search, LockKeyhole, Bookmark, Bug, SquareDashedMousePointer, Pin } from "lucide-react"
import { useRouter } from "@vessel/react-router"
import Layout from "@/layout"
import ActivityBar from "@/layout/activity-bar"
import { Button } from "@/components/ui/button"
import { browserURL } from "./url"
import "./index.css"

type Tab = { favicon?: string; id: string; url: string; title: string; loading: boolean; back: boolean; forward: boolean; error: string; zoom: number }
const newTab = (): Tab => ({ id: crypto.randomUUID(), url: "", title: "新标签页", loading: false, back: false, forward: false, error: "", zoom: 1 })
const shortcuts = [
  { title: "GitHub", url: "https://github.com" },
  { title: "StackOverflow", url: "https://stackoverflow.com" },
  { title: "MDN Docs", url: "https://developer.mozilla.org" },
  { title: "React", url: "https://react.dev" }
]
function Guest({ tab, visible, register, update }: { tab: Tab; visible: boolean; register: (id: string, view: WebviewTag | null) => void; update: (id: string, patch: Partial<Tab>) => void }) {
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
    const onReady = () => { markGuestReady(view, true); sync(); updateRef.current(tab.id, { loading: false }) }
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
    view.addEventListener("page-favicon-updated", favicon)
    view.addEventListener("dom-ready", onReady)
    view.addEventListener("did-navigate", sync)
    view.addEventListener("did-navigate-in-page", sync)
    view.addEventListener("page-title-updated", sync)
    view.addEventListener("did-start-navigation", start)
    view.addEventListener("did-stop-loading", stop)
    view.addEventListener("did-fail-load", fail)
    return () => {
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
    ref={view => { ref.current = view as WebviewTag | null; register(tab.id, ref.current) }}
    src={initialURL}
    {...webviewAttributes}
    style={{ width: "100%", height: "100%", display: visible ? "flex" : "none" }}
  />
}
export default function BrowserPage({ visible = true }: { visible?: boolean }) {
  const router = useRouter()
  const [deviceViewport, setDeviceViewport] = useState({ width: 390, height: 844, scale: 1 })
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [deviceMode, setDeviceMode] = useState(false)
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()])
  const [findOpen, setFindOpen] = useState(false)
  const [matchCase, setMatchCase] = useState(false)
  const [findText, setFindText] = useState("")
  const [findResult, setFindResult] = useState({ activeMatchOrdinal: 0, matches: 0, tabId: "", text: "" })
  const findInput = useRef<HTMLInputElement>(null)
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
  const [active, setActive] = useState("")
  const [input, setInput] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem("browser-bookmarks") || "null") as typeof shortcuts) || shortcuts
    } catch {
      return shortcuts
    }
  })
  const views = useRef(new Map<string, WebviewTag>())
  const tab = tabs.find((item) => item.id === active) || tabs[0]
  useEffect(() => { publishBrowserTabs(tabs.filter(item => Boolean(item.url)).map(item => ({ id: item.id, title: item.title, url: item.url, favicon: item.favicon, active: item.id === tab.id }))) }, [tabs, tab.id])
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); show() }
    }
    window.addEventListener("keydown", keydown)
    const unsubscribe = window.electronAPI.onBrowserFind(id => {
      if (withGuest(views.current.get(tab.id), guest => guest.getWebContentsId()) === id) show()
    })
    return () => { window.removeEventListener("keydown", keydown); unsubscribe() }
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
  const update = (id: string, patch: Partial<Tab>) => setTabs((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
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
  useEffect(() => window.electronAPI.onBrowserNewTab(url => {
    if (!/^https?:\/\//i.test(url)) return
    const item = { ...newTab(), url, loading: true }
    setTabs(current => [...current, item])
    setActive(item.id)
    setInput(null)
  }), [])
  const close = (id: string) => {
    const remaining = tabs.filter((item) => item.id !== id)
    if (!remaining.length) remaining.push(newTab())
    setTabs(remaining)
    if (tab.id === id) {
      setActive(remaining[0].id)
      setInput(null)
    }
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
    const next = bookmarks.some((item) => item.url === tab.url) ? bookmarks.filter((item) => item.url !== tab.url) : [...bookmarks, { url: tab.url, title: tab.title }]
    setBookmarks(next)
    localStorage.setItem("browser-bookmarks", JSON.stringify(next))
  }
  return (
    <Layout
      aside={
        <ActivityBar
          activity="browser"
          onActivityChange={(item) => {
            if (item !== "browser") void router.push(item === "resources" ? "/resources" : item === "todos" ? "/todos" : item === "tools" ? "/devtools" : "/editor")
          }}
        />
      }
    >
      <main className="vessel-browser flex min-w-0 flex-1 flex-col overflow-hidden font-sans">
        <div className="browser-tabs">
          {tabs.map((item) => (
            <div
              key={item.id}
              className={`browser-tab ${item.id === tab.id ? "selected" : ""}`}
            >
              <button
                onClick={() => {
                  setActive(item.id)
                  setInput(null)
                }}
                className="browser-tab-select flex min-w-0 flex-1 items-center gap-2"
              >
                {item.favicon ? <img src={item.favicon} alt="" className="size-4 shrink-0 object-contain" onError={() => update(item.id, { favicon: undefined })} /> : <Globe size={14} className="shrink-0 text-green-600" />}
                <span className="truncate">{item.title}</span>
              </button>
              <button
                title="关闭标签页"
                onClick={() => close(item.id)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <TabSwitcher tabs={tabs.filter(item => Boolean(item.url)).map(item => ({ ...item, active: item.id === tab.id }))} onSelect={id => { setActive(id); setInput(null) }}><Button
            variant="ghost"
            size="icon"
            title="新标签页"
            onClick={add}
          >
            <Plus />
          </Button></TabSwitcher>
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
            title={tab.loading ? "停止" : "刷新"}
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
            <input
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
        <div className="browser-bookmarks">
          {bookmarks.map((item) => (
            <button
              key={item.url}
              title={item.url}
              onClick={() => navigate(item.url)}
            >
              <Globe size={12} />
              {item.title}
            </button>
          ))}
        </div>
        </div></div>
        {deviceMode && <DeviceToolbar onViewport={setDeviceViewport} guest={() => views.current.get(tab.id)} tabId={tab.id} onClose={() => setDeviceMode(false)} />}
        <div className={`browser-content dock-${dock}`}>
        <div className="relative min-h-0 min-w-0 flex-1 bg-white">
          {findOpen && <form className="browser-find" aria-label="网页查找" onSubmit={event => { event.preventDefault(); searchPage(true, true) }}>
            <Search size={15} className="text-stone-400" />
            <input ref={findInput} aria-label="在网页中查找" placeholder="在网页中查找" spellCheck={false} value={findText} onChange={event => setFindText(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setFindOpen(false); if (event.key === "Enter" && event.shiftKey) { event.preventDefault(); searchPage(false, true) } }} />
            <span className="browser-find-count">{findResult.tabId === tab.id && findResult.text === findText ? `${findResult.activeMatchOrdinal}/${findResult.matches}` : "0/0"}</span>
            <button type="button" aria-label="上一个匹配" disabled={!findText || !findResult.matches} onClick={() => searchPage(false, true)}><ChevronUp size={15} /></button>
            <button type="submit" aria-label="下一个匹配" disabled={!findText || !findResult.matches}><ChevronDown size={15} /></button>
            <span className="browser-find-divider" />
            <button type="button" aria-label="区分大小写" aria-pressed={matchCase} onClick={() => setMatchCase(value => !value)}>Aa</button>
            <button type="button" className="browser-find-close" aria-label="关闭查找" onClick={() => setFindOpen(false)}><X size={15} /></button>
          </form>}

          {tab.loading && <div className="browser-page-loading" role="status" aria-label="正在加载页面">
            <div className="browser-loading-bar" />
            <div className="browser-loading-card"><img src={browserLoading} alt="" /><div>正在加载页面<span className="browser-loading-dots"><span>.</span><span>.</span><span>.</span></span></div><small title={tab.url}>{tab.url}</small></div>
          </div>}
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
                register={(id, view) => {
                  if (view) views.current.set(id, view)
                  else views.current.delete(id)
                }}
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
                <input
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
        {devtoolsOpen && tab.url && <section className="browser-devtools" style={dock === "bottom" ? { position: "relative", height: Math.min(consoleHeight, window.innerHeight * 0.7) } : undefined} aria-label="当前网页控制台">
          {dock === "bottom" && <ResizeEdge width={consoleHeight} min={180} max={window.innerHeight * 0.7} side="top" label="调整控制台高度" onChange={value => { setConsoleHeight(value); localStorage.setItem("browser-console-height", String(value)) }} />}
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
        </section>}
        </div>
      <footer className="browser-status">
        <button aria-label={toolbarCollapsed ? "展开浏览器工具栏" : "折叠浏览器工具栏"} aria-expanded={!toolbarCollapsed} onClick={() => setToolbarCollapsed(value => !value)} className="flex size-5 shrink-0 items-center justify-center text-stone-400 hover:text-stone-700">{toolbarCollapsed ? <ChevronUp size={13} /> : <ChevronRight size={13} />}</button>
          <span>{tab.loading ? "正在加载…" : tab.url || "就绪"}</span>
          <span className="ml-auto shrink-0"><Clock ticking interval={1000} format="YYYY年MM月DD日 HH:mm" /></span>
          <span>{Math.round(tab.zoom * 100)}%</span>
        </footer>
      </main>
    </Layout>
  )
}
