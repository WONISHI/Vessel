import { useEffect, useRef, useState } from "react"
import type { WebviewTag } from "electron"
import { ArrowLeft, ArrowRight, RotateCw, Home, Globe, Plus, X, Search, LockKeyhole, Bookmark, ZoomIn, ZoomOut, Code } from "lucide-react"
import { useRouter } from "@vessel/react-router"
import Layout from "@/layout"
import ActivityBar from "@/layout/activity-bar"
import { Button } from "@/components/ui/button"
import { browserURL } from "./url"
import "./index.css"

type Tab = { id: string; url: string; title: string; loading: boolean; back: boolean; forward: boolean; error: string; zoom: number }
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
    const fail = (event: Electron.DidFailLoadEvent) => {
      if (event.isMainFrame && event.errorCode !== -3) updateRef.current(tab.id, { loading: false, error: `页面加载失败：${event.errorDescription}` })
    }
    view.addEventListener("dom-ready", sync)
    view.addEventListener("did-navigate", sync)
    view.addEventListener("did-navigate-in-page", sync)
    view.addEventListener("page-title-updated", sync)
    view.addEventListener("did-start-loading", start)
    view.addEventListener("did-stop-loading", stop)
    view.addEventListener("did-fail-load", fail)
    return () => {
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
    {...{ partition: "persist:vessel-browser" }}
    style={{ width: "100%", height: "100%", display: visible ? "flex" : "none" }}
  />
}
export default function BrowserPage() {
  const router = useRouter()
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()])
  const [active, setActive] = useState("")
  const [input, setInput] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem("browser-bookmarks") || "null") as typeof shortcuts) || shortcuts
    } catch {
      return shortcuts
    }
  })
  const views = useRef(new Map<string, WebviewTag>())
  const tab = tabs.find((item) => item.id === active) || tabs[0]
  const update = (id: string, patch: Partial<Tab>) => setTabs((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
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
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <Globe
                  size={14}
                  className="shrink-0 text-green-600"
                />
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
          <Button
            variant="ghost"
            size="icon"
            title="网页开发者工具"
            disabled={!tab.url}
            onClick={() => views.current.get(tab.id)?.openDevTools()}
          >
            <Code />
          </Button>
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
        <div className="relative min-h-0 flex-1 bg-white">
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
                  navigate(input ?? "")
                }}
              >
                <Search size={20} />
                <input
                  aria-label="搜索"
                  placeholder="搜索或输入网址，按 Enter 访问"
                  value={input ?? ""}
                  onChange={(event) => setInput(event.target.value)}
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
        <footer className="browser-status">
          <span>{tab.loading ? "正在加载…" : tab.url || "就绪"}</span>
          <span>{Math.round(tab.zoom * 100)}%</span>
        </footer>
      </main>
    </Layout>
  )
}
