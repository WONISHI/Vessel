import { elementPickerScript } from "./element-picker"
import { webviewAttributes } from "./webview-attributes"
import { useEffect, useRef, useState } from "react"
import type { WebviewTag } from "electron"
import { ArrowLeft, ArrowRight, RotateCw, Home, Globe, Plus, X, Search, LockKeyhole, Bookmark, ZoomIn, ZoomOut, Bug, ScanSearch } from "lucide-react"
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
    const sync = () => updateRef.current(tab.id, { url: view.getURL(), title: view.getTitle() || "正在加载…", back: view.canGoBack(), forward: view.canGoForward() })
    const start = () => updateRef.current(tab.id, { loading: true, error: "" })
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
    view.addEventListener("dom-ready", sync)
    view.addEventListener("did-navigate", sync)
    view.addEventListener("did-navigate-in-page", sync)
    view.addEventListener("page-title-updated", sync)
    view.addEventListener("did-start-loading", start)
    view.addEventListener("did-stop-loading", stop)
    view.addEventListener("did-fail-load", fail)
    return () => {
      view.removeEventListener("page-favicon-updated", favicon)
      view.removeEventListener("dom-ready", sync)
      view.removeEventListener("did-navigate", sync)
      view.removeEventListener("did-navigate-in-page", sync)
      view.removeEventListener("page-title-updated", sync)
      view.removeEventListener("did-start-loading", start)
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
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()])
  const [findOpen, setFindOpen] = useState(false)
  const [findText, setFindText] = useState("")
  const [findResult, setFindResult] = useState({ activeMatchOrdinal: 0, matches: 0, tabId: "", text: "" })
  const findInput = useRef<HTMLInputElement>(null)
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
  const searchPage = (forward = true, next = false) => {
    const view = views.current.get(tab.id)
    if (findText) view?.findInPage(findText, { forward, findNext: next })
    else view?.stopFindInPage("clearSelection")
  }
  useEffect(() => {
    if (!visible) return
    const show = () => { setFindOpen(true); requestAnimationFrame(() => findInput.current?.focus()) }
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); show() }
    }
    window.addEventListener("keydown", keydown)
    const unsubscribe = window.electronAPI.onBrowserFind(id => {
      if (views.current.get(tab.id)?.getWebContentsId() === id) show()
    })
    return () => { window.removeEventListener("keydown", keydown); unsubscribe() }
  }, [visible, tab.id])
  useEffect(() => {
    const view = views.current.get(tab.id)
    const result = (event: Electron.FoundInPageEvent) => setFindResult({ ...event.result, tabId: tab.id, text: findText })
    view?.addEventListener("found-in-page", result)
    if (findOpen && findText) view?.findInPage(findText)
    else view?.stopFindInPage("clearSelection")
    return () => { view?.removeEventListener("found-in-page", result); view?.stopFindInPage("clearSelection") }
  }, [findText, findOpen, tab.id])
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
  const zoom = (delta: number) => {
    const value = Math.max(0.5, Math.min(2, tab.zoom + delta))
    views.current.get(tab.id)?.setZoomFactor(value)
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
            if (item !== "browser") void router.push(item === "todos" ? "/todos" : item === "tools" ? "/devtools" : "/editor")
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
          <Button
            variant="ghost"
            size="icon"
            title="新标签页"
            onClick={add}
          >
            <Plus />
          </Button>
        </div>
        <div className="browser-toolbar">
          <Button
            variant="ghost"
            size="icon"
            title="后退"
            disabled={!tab.back}
            onClick={() => views.current.get(tab.id)?.goBack()}
          >
            <ArrowLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="前进"
            disabled={!tab.forward}
            onClick={() => views.current.get(tab.id)?.goForward()}
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
              if (tab.loading) view?.stop()
              else view?.reload()
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
          <Button
            variant="ghost"
            size="icon"
            title="放大"
            onClick={() => zoom(0.1)}
          >
            <ZoomIn />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="缩小"
            onClick={() => zoom(-0.1)}
          >
            <ZoomOut />
          </Button>
          <Button variant="ghost" size="icon" title="查看元素信息（Esc 退出，再次点击关闭）" aria-label="查看元素信息" disabled={!tab.url}
            onClick={() => { void views.current.get(tab.id)?.executeJavaScript(elementPickerScript).catch(error => window.alert(`无法查看元素：${String(error)}`)) }}>
            <ScanSearch />
          </Button>
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
        </div>
        {findOpen && <form className="flex shrink-0 items-center justify-end gap-2 border-b bg-white p-2 text-xs" onSubmit={event => { event.preventDefault(); searchPage(true, true) }}>
          <input ref={findInput} aria-label="在网页中查找" placeholder="在网页中查找" spellCheck={false} value={findText} onChange={event => setFindText(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setFindOpen(false); if (event.key === "Enter" && event.shiftKey) { event.preventDefault(); searchPage(false, true) } }} />
          <span>{findResult.tabId === tab.id && findResult.text === findText ? `${findResult.activeMatchOrdinal} / ${findResult.matches}` : "0 / 0"}</span>
          <button type="button" aria-label="上一个匹配" onClick={() => searchPage(false, true)}>↑</button>
          <button type="submit" aria-label="下一个匹配">↓</button>
          <button type="button" aria-label="关闭查找" onClick={() => setFindOpen(false)}><X size={14} /></button>
        </form>}
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
        <div className={`browser-content dock-${dock}`}>
        <div className="relative min-h-0 min-w-0 flex-1 bg-white">
          {tab.loading && <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-green-500" />}
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
        {devtoolsOpen && tab.url && <section className="browser-devtools" aria-label="当前网页控制台">
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
          <span>{tab.loading ? "正在加载…" : tab.url || "就绪"}</span>
          <span>{Math.round(tab.zoom * 100)}%</span>
        </footer>
      </main>
    </Layout>
  )
}
