import { freezeBrowserTab, useTabFreezing, wakeBrowserTab } from "@/pages/browser/use-tab-freezing"
import { useBrowserWindows } from "@/pages/browser/use-browser-windows"
import { useActivatedTabs } from "@/pages/browser/use-activated-tabs"
import { BROWSER_ACTIVE_TAB_KEY, BROWSER_TABS_KEY, loadSavedBrowserTabs, newTab, PAGE_EXTRACTOR_SCRIPT, SavedBrowserTab, shortcuts } from "@/pages/browser/components/index-shared"
import { transitionPage } from "@/lib/page-transition"
import { publishBrowserTabs } from "@/pages/browser/tab-state"
import { useRouter } from "@vessel/react-router"
import type { WebviewTag } from "electron"
import { useCallback, useEffect, useRef, useState } from "react"

/** 浏览器页的标签、查找、控制台与书签状态及持久化 */
export function useBrowserState(visible: boolean) {
  const router = useRouter()
  const [deviceViewport, setDeviceViewport] = useState({ width: 390, height: 844, scale: 1 })
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [bookmarksVisible, setBookmarksVisible] = useState(() => localStorage.getItem("browser-bookmarks-visible") !== "false")
  useEffect(() => { localStorage.setItem("browser-bookmarks-visible", String(bookmarksVisible)) }, [bookmarksVisible])
  const [deviceMode, setDeviceMode] = useState(false)
  const [initialTabsState] = useState(loadSavedBrowserTabs)
  const browserWindows = useBrowserWindows(initialTabsState)
  const { tabs, allTabs, setTabs, setAllTabs, active, setActiveId, userWindow } = browserWindows
  const [findOpen, setFindOpen] = useState(false)
  const [matchCase, setMatchCase] = useState(false)
  const [findText, setFindText] = useState("")
  const [findResult, setFindResult] = useState({ activeMatchOrdinal: 0, matches: 0, tabId: "", text: "" })
  const findInput = useRef<HTMLInputElement>(null)
  const [findPosition, setFindPosition] = useState<{ x: number; y: number } | null>(null)
  const findDrag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  useEffect(() => {
    /** Stops stop. */
    const stop = () => {
      findDrag.current = null
      document.body.classList.remove("vessel-find-dragging")
    }
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
    window.addEventListener("blur", stop)
    return () => {
      stop()
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
      window.removeEventListener("blur", stop)
    }
  }, [])
  const [consoleWidth, setConsoleWidth] = useState(() => Number(localStorage.getItem("browser-console-width")) || 440)
  const [consoleHeight, setConsoleHeight] = useState(() => Number(localStorage.getItem("browser-console-height")) || 300)
  const [devtoolsOpen, setDevtoolsOpen] = useState(false)
  const [dock, setDock] = useState(() => localStorage.getItem("browser-devtools-dock") || "bottom")
  const [consoleFont, setConsoleFont] = useState(() => localStorage.getItem("browser-devtools-font") || "Menlo")
  const [consoleLanguage, setConsoleLanguage] = useState<"zh" | "en-US">(() => localStorage.getItem("browser-devtools-language") === "en-US" ? "en-US" : "zh")
  const [consoleSize, setConsoleSize] = useState(() => Number(localStorage.getItem("browser-devtools-size")) || 13)
  useEffect(() => {
    localStorage.setItem("browser-devtools-dock", dock)
    localStorage.setItem("browser-devtools-font", consoleFont)
    localStorage.setItem("browser-devtools-size", String(consoleSize))
    localStorage.setItem("browser-devtools-language", consoleLanguage)
  }, [dock, consoleFont, consoleSize, consoleLanguage])
  useEffect(() => window.electronAPI.onBrowserDevtoolsClosed(() => setDevtoolsOpen(false)), [])
  const devtoolsHost = useRef<HTMLDivElement>(null)
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])
  const setActive = useCallback((id: string) => {
    const previous = activeRef.current
    activeRef.current = id
    const now = Date.now()
    setAllTabs((current) => current.map((item) => item.id === id ? wakeBrowserTab(item, now) : item.id === previous ? { ...item, lastActiveAt: now } : item))
    setActiveId(id)
  }, [setAllTabs, setActiveId])
  const activatedTabs = useActivatedTabs(active, allTabs)
  const freezeTab = useCallback((id: string) => {
    setTabs((current) => current.map((item) => item.id === id && item.url && !item.frozen ? freezeBrowserTab(item) : item))
    if (id === activeRef.current) setDevtoolsOpen(false)
  }, [setTabs])
  useEffect(() => {
    /** Opens open. */
    const open = () => {
      if (!visible) return
      const url = sessionStorage.getItem("vessel-browser-pending-url")
      if (!url) return
      sessionStorage.removeItem("vessel-browser-pending-url")
      if (!/^(file|https?):\/\//i.test(url)) return
      const item = { ...newTab(), url, loading: true }
      setTabs((current) => [...current, item])
      setActive(item.id)
    }
    open()
    window.addEventListener("vessel-browser-open-url", open)
    return () => window.removeEventListener("vessel-browser-open-url", open)
  }, [visible])
  const [input, setInput] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const resetWindowControls = () => {
    setInput(null)
    setSearchInput("")
    setFindOpen(false)
    setFindText("")
    setDevtoolsOpen(false)
  }
  const [bookmarks, setBookmarks] = useState<{ url: string; title: string; favicon?: string }[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("browser-bookmarks") || "null")
      if (Array.isArray(saved) && saved.length > 0 && shortcuts.some((sc) => saved.some((s) => s.url === sc.url))) {
        return saved
      }
    } catch { /* Keep the default bookmarks when storage is unavailable. */ }
    localStorage.setItem("browser-bookmarks", JSON.stringify(shortcuts))
    return shortcuts
  })

  // 保持 Vessel 自身的 SQLite 数据库同步
  useEffect(() => {
    void window.electronAPI.syncBrowserBookmarks(bookmarks).catch(console.error)
  }, [bookmarks])

  /** Removes bookmark. */
  const removeBookmark = useCallback((url: string) => {
    setBookmarks((current) => {
      const next = current.filter((item) => item.url !== url)
      localStorage.setItem("browser-bookmarks", JSON.stringify(next))
      return next
    })
  }, [])

  /** Resets bookmarks. */
  const resetBookmarks = useCallback(() => {
    setBookmarks(shortcuts)
    localStorage.setItem("browser-bookmarks", JSON.stringify(shortcuts))
    void window.electronAPI.syncBrowserBookmarks(shortcuts).catch(console.error)
  }, [])
  const views = useRef(new Map<string, WebviewTag>())

  /** Registers view. */
  const registerView = useCallback((id: string, view: WebviewTag | null) => {
    if (view) views.current.set(id, view)
    else views.current.delete(id)
  }, [])
  const tab = tabs.find((item) => item.id === active) || tabs[0]
  useTabFreezing(tab.id, setTabs, views)

  /** Returns active page data. */
  const getActivePageData = useCallback(async () => {
    const currentTab = tabs.find((t) => t.id === active) || tabs[0]
    if (!currentTab) return null
    let view = views.current.get(currentTab.id)
    if (!view) {
      const allWebviews = Array.from(document.querySelectorAll<WebviewTag>("webview"))
      view = allWebviews.find((w) => w.style.display !== "none") || allWebviews[0] || null
    }
    if (!view) {
      return {
        title: currentTab.title,
        url: currentTab.url,
        timestamp: new Date().toISOString()
      }
    }
    try {
      const data = await view.executeJavaScript(PAGE_EXTRACTOR_SCRIPT)
      if (data && (data.articleHtml || data.selectedText || data.articleText)) {
        return data
      }
      // 容错降级：若提取的内容为空，直接获取 webview 内的 innerText
      const fallbackText = await view.executeJavaScript(`(() => (document.body ? document.body.innerText : ''))()`).catch(() => "")
      return {
        ...data,
        title: data?.title || currentTab.title,
        url: data?.url || currentTab.url,
        articleHtml: data?.articleHtml || (fallbackText ? "<p>" + fallbackText.replace(/\\n+/g, "</p><p>") + "</p>" : ""),
        articleText: data?.articleText || fallbackText || "",
        timestamp: new Date().toISOString()
      }
    } catch (err) {
      console.warn("[getActivePageData] Failed to execute extractor script:", err)
      let fallbackText = ""
      try {
        fallbackText = await view.executeJavaScript(`(() => (document.body ? document.body.innerText : ''))()`)
      } catch { /* The page may have closed while extracting its content. */ }
      return {
        title: currentTab.title,
        url: currentTab.url,
        articleHtml: fallbackText ? "<p>" + fallbackText.replace(/\\n+/g, "</p><p>") + "</p>" : "",
        articleText: fallbackText,
        timestamp: new Date().toISOString()
      }
    }
  }, [active, tabs])
  useEffect(() => {
    publishBrowserTabs(tabs.filter((item) => Boolean(item.url)).map((item) => ({ id: item.id, title: item.title, url: item.url, favicon: item.favicon, frozen: item.frozen, active: item.id === tab.id })), browserWindows.incognito)
  }, [tabs, tab.id, browserWindows.incognito])
  const lastSavedTabs = useRef("")
  useEffect(() => {
    try {
      const savedTabs: SavedBrowserTab[] = userWindow.tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        favicon: t.favicon,
        pinned: t.pinned,
        openerId: t.openerId,
        zoom: t.zoom
      }))
      const serialized = JSON.stringify(savedTabs)
      if (lastSavedTabs.current !== serialized) {
        localStorage.setItem(BROWSER_TABS_KEY, serialized)
        lastSavedTabs.current = serialized
      }
      if (localStorage.getItem(BROWSER_ACTIVE_TAB_KEY) !== userWindow.active) localStorage.setItem(BROWSER_ACTIVE_TAB_KEY, userWindow.active)
    } catch (error) {
      console.error("Failed to save browser tabs:", error)
    }
  }, [userWindow])
  useEffect(() => {
    /** Selects select. */
    const select = (event: Event) => {
      setActive((event as CustomEvent<string>).detail)
      setInput(null)
    }
    window.addEventListener("vessel-browser-tab", select)
    return () => window.removeEventListener("vessel-browser-tab", select)
  }, [])

  return { ...browserWindows,
    enterIncognito: async () => { await browserWindows.enterIncognito(apply => transitionPage(() => { apply(); resetWindowControls() }, "browser", { contentReady: true })) },
    closeIncognito: async () => { await browserWindows.closeIncognito(); resetWindowControls() },
    switchUserWindow: () => { void transitionPage(() => { browserWindows.switchUserWindow(); resetWindowControls() }, "browser", { contentReady: true }).catch(console.error) },
    bookmarksVisible, setBookmarksVisible, router, deviceViewport, setDeviceViewport, toolbarCollapsed, setToolbarCollapsed, deviceMode, setDeviceMode, initialTabsState, tabs, setTabs, findOpen, setFindOpen, matchCase, setMatchCase, findText, setFindText, findResult, setFindResult, findInput, findPosition, setFindPosition, findDrag, consoleWidth, setConsoleWidth, consoleHeight, setConsoleHeight, devtoolsOpen, setDevtoolsOpen, dock, setDock, consoleFont, setConsoleFont, consoleSize, setConsoleSize, consoleLanguage, setConsoleLanguage, devtoolsHost, active, setActive, freezeTab, activatedTabs, input, setInput, searchInput, setSearchInput, bookmarks, setBookmarks, removeBookmark, resetBookmarks, views, registerView, tab, getActivePageData, lastSavedTabs }
}

export type BrowserState = ReturnType<typeof useBrowserState>
