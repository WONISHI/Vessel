import browserLoading from "@/assets/vessel-browser-loading/loading.svg"
import ActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { TabSwitcher } from "@/components/tab-switcher"
import { addTransit } from "@/components/transit/state"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { ResizableSplit } from "@/components/ui/resizable-split"
import { StatusBar } from "@/components/ui/status-bar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BookmarkBar } from "@/pages/browser/components/bookmark-bar"
import { BrowserExtensions } from "@/pages/browser/components/extensions"
import { Guest } from "@/pages/browser/components/guest"
import { HistoryInput } from "@/pages/browser/components/history-input"
import { BROWSER_ACTIVE_TAB_KEY, BROWSER_TABS_KEY, loadSavedBrowserTabs, newTab, PAGE_EXTRACTOR_SCRIPT, SavedBrowserTab, shortcuts, Tab } from "@/pages/browser/components/index-shared"
import { BrowserProxy } from "@/pages/browser/components/proxy"
import { BrowserMore, DeviceToolbar } from "@/pages/browser/components/tools"
import { elementPickerScript } from "@/pages/browser/element-picker"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import { publishBrowserTabs } from "@/pages/browser/tab-state"
import { browserURL } from "@/pages/browser/url"
import { useRouter } from "@vessel/react-router"
import { matchesShortcut } from "@vessel/utils"
import type { WebviewTag } from "electron"
import { ArrowLeft, ArrowRight, Bookmark, Bug, ChevronDown, ChevronRight, ChevronUp, Globe, Home, Link2, LockKeyhole, Pin, Plus, RotateCw, Search, SquareDashedMousePointer, X, ZoomIn } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

/** Renders the browser page component. */
export function BrowserPage({ visible = true }: { visible?: boolean }) {
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
  const [bookmarks, setBookmarks] = useState<{ url: string; title: string; favicon?: string }[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("browser-bookmarks") || "null")
      if (Array.isArray(saved) && saved.length > 0 && shortcuts.some((sc) => saved.some((s) => s.url === sc.url))) {
        return saved
      }
    } catch {}
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
      } catch (_) {}
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
    publishBrowserTabs(tabs.filter((item) => Boolean(item.url)).map((item) => ({ id: item.id, title: item.title, url: item.url, favicon: item.favicon, active: item.id === tab.id })))
  }, [tabs, tab.id])
  useEffect(() => {
    try {
      const savedTabs: SavedBrowserTab[] = tabs.map((t) => ({
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
    /** Selects select. */
    const select = (event: Event) => {
      setActive((event as CustomEvent<string>).detail)
      setInput(null)
    }
    window.addEventListener("vessel-browser-tab", select)
    return () => window.removeEventListener("vessel-browser-tab", select)
  }, [])

  /** Performs the search page operation. */
  const searchPage = (forward = true, next = false) => {
    const view = views.current.get(tab.id)
    if (findText) withGuest(view, (guest) => guest.findInPage(findText, { forward, findNext: next, matchCase }))
    else withGuest(view, (guest) => guest.stopFindInPage("clearSelection"))
  }
  useEffect(() => {
    if (!visible) return

    /** Shows show. */
    const show = () => {
      setFindOpen(true)
      requestAnimationFrame(() => {
        findInput.current?.focus()
        findInput.current?.select()
      })
    }

    /** Performs the keydown operation. */
    const keydown = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && matchesShortcut(event, "find")) {
        event.preventDefault()
        show()
      }
      if (matchesShortcut(event, "devtools")) {
        event.preventDefault()
        setDevtoolsOpen((open) => !open)
      }
      if (!event.defaultPrevented && matchesShortcut(event, "refreshBrowser")) {
        event.preventDefault()
        if (!event.repeat) withGuest(views.current.get(tab.id), (guest) => guest.reload())
      }
    }
    window.addEventListener("keydown", keydown)

    /** Performs the page find operation. */
    const pageFind = (event: Event) => {
      if (withGuest(views.current.get(tab.id), (guest) => guest.getWebContentsId()) === (event as CustomEvent<number>).detail) show()
    }
    window.addEventListener("vessel-browser-find", pageFind)
    const stopDevtools = window.electronAPI.onBrowserToggleDevtools?.((id) => {
      if (withGuest(views.current.get(tab.id), (guest) => guest.getWebContentsId()) === id) setDevtoolsOpen((open) => !open)
    })
    const unsubscribe = window.electronAPI.onBrowserFind((id) => {
      if (withGuest(views.current.get(tab.id), (guest) => guest.getWebContentsId()) === id) show()
    })
    return () => {
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("vessel-browser-find", pageFind)
      stopDevtools?.()
      unsubscribe()
    }
  }, [visible, tab.id])
  useEffect(() => {
    const view = views.current.get(tab.id)

    /** Performs the result operation. */
    const result = (event: Electron.FoundInPageEvent) => setFindResult({ ...event.result, tabId: tab.id, text: findText })
    view?.addEventListener("found-in-page", result)

    /** Finds find. */
    const find = () => {
      if (findOpen && findText) withGuest(view, (guest) => guest.findInPage(findText, { matchCase }))
      else withGuest(view, (guest) => guest.stopFindInPage("clearSelection"))
    }
    view?.addEventListener("dom-ready", find)
    find()
    return () => {
      view?.removeEventListener("dom-ready", find)
      view?.removeEventListener("found-in-page", result)
      withGuest(view, (guest) => guest.stopFindInPage("clearSelection"))
    }
  }, [findText, findOpen, tab.id, matchCase])

  /** Refreshes the current state. */
  const update = useCallback(
    (id: string, patch: Partial<Tab>) =>
      setTabs((current) => {
        const index = current.findIndex((item) => item.id === id)
        if (index < 0 || (Object.keys(patch) as (keyof Tab)[]).every((key) => current[index][key] === patch[key])) return current
        const next = [...current]
        next[index] = { ...current[index], ...patch }
        return next
      }),
    []
  )
  useEffect(() => {
    const element = devtoolsHost.current
    const view = views.current.get(tab.id)
    if (!visible || !devtoolsOpen || !element || !view) {
      void window.electronAPI.setBrowserDevtools(null).catch(() => {})
      return
    }
    let disposed = false

    /** Synchronizes sync. */
    const sync = () => {
      const { x, y, width, height } = element.getBoundingClientRect()
      try {
        void window.electronAPI.setBrowserDevtools(view.getWebContentsId(), { x, y, width, height }, { font: consoleFont, size: consoleSize, detached: dock === "detached" }).catch((error) => {
          if (!disposed) {
            update(tab.id, { error: String(error) })
            setDevtoolsOpen(false)
          }
        })
      } catch {
        /* guest 尚未完成挂载，dom-ready 后重试。 */
      }
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

  /** Performs the navigate operation. */
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

  /** Adds add. */
  const add = () => {
    const item = newTab()
    setTabs((current) => [...current, item])
    setActive(item.id)
    setInput(null)
  }
  useEffect(
    () =>
      window.electronAPI.onBrowserNewTab((url, opener) => {
        if (!/^(https?|chrome-extension|file):\/\//i.test(url)) return
        const item = { ...newTab(), url, loading: true, openerId: [...views.current.entries()].find(([, view]) => withGuest(view, (guest) => guest.getWebContentsId()) === opener)?.[0] }
        setTabs((current) => [...current, item])
        setActive(item.id)
        setInput(null)
      }),
    []
  )

  /** Closes close. */
  const close = (id: string) => {
    const remaining = tabs.filter((item) => item.id !== id)
    if (!remaining.length) remaining.push(newTab())
    setTabs(remaining)
    if (tab.id === id) {
      setActive(remaining.find((item) => item.id === tab.openerId)?.id || remaining[Math.max(0, tabs.findIndex((item) => item.id === id) - 1)].id)
      setInput(null)
    }
  }

  /** Adds tab right of. */
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

  /** Reloads tab. */
  const reloadTab = (id: string) => {
    const view = views.current.get(id)
    withGuest(view, (guest) => guest.reload())
  }

  /** Toggles pin tab. */
  const togglePinTab = (id: string) => {
    setTabs((current) => current.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)))
  }

  /** Closes other tabs. */
  const closeOtherTabs = (id: string) => {
    setTabs((current) => current.filter((t) => t.id === id || t.pinned))
    setActive(id)
    setInput(null)
  }

  /** Closes right tabs. */
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

  /** Performs the reorder tabs operation. */
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
    /** Performs the action operation. */
    const action = (event: Event) => {
      const detail = (event as CustomEvent<{ action: string; id: string }>).detail
      if (detail.action === "new") add()
      else if (detail.action === "close") close(detail.id)
    }
    window.addEventListener("vessel-browser-tab-action", action)
    return () => window.removeEventListener("vessel-browser-tab-action", action)
  })

  /** Performs the zoom operation. */
  const zoom = (delta: number) => {
    const value = Math.max(0.5, Math.min(2, tab.zoom + delta))
    withGuest(views.current.get(tab.id), (guest) => guest.setZoomFactor(value))
    update(tab.id, { zoom: value })
  }

  /** Performs the bookmark operation. */
  const bookmark = () => {
    if (!tab.url) return
    const next = bookmarks.some((item) => item.url === tab.url) ? bookmarks.filter((item) => item.url !== tab.url) : [...bookmarks, { url: tab.url, title: tab.title, favicon: tab.favicon }]
    setBookmarks(next)
    localStorage.setItem("browser-bookmarks", JSON.stringify(next))
    void window.electronAPI.syncBrowserBookmarks(next).catch(() => {})
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
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.id)
                    setDragTabId(item.id)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const sourceId = e.dataTransfer.getData("text/plain") || dragTabId
                    if (sourceId && sourceId !== item.id) reorderTabs(sourceId, item.id)
                  }}
                  onDragEnd={() => setDragTabId(null)}
                  className={`browser-tab ${item.id === tab.id ? "selected" : ""} ${item.pinned ? "pinned" : ""}`}
                >
                  <button
                    onClick={() => {
                      setActive(item.id)
                      setInput(null)
                    }}
                    className="browser-tab-select flex min-w-0 flex-1 items-center gap-2"
                    data-title={item.title}
                  >
                    {item.favicon ? (
                      <img
                        src={item.favicon}
                        alt=""
                        className="size-4 shrink-0 object-contain"
                        onError={() => update(item.id, { favicon: undefined })}
                      />
                    ) : (
                      <Globe
                        size={14}
                        className="shrink-0 text-green-600"
                      />
                    )}
                    {!item.pinned && <span className="truncate">{item.title}</span>}
                  </button>
                  {!item.pinned && (
                    <button
                      data-title="关闭标签页"
                      onClick={() => close(item.id)} aria-label="关闭标签页"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem onSelect={() => addTabRightOf(item.id)}>
                  <Plus />
                  在右侧新增标签页
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => reloadTab(item.id)}>
                  <RotateCw />
                  重新加载
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => togglePinTab(item.id)}>
                  <Pin />
                  {item.pinned ? "取消固定" : "固定"}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => close(item.id)}>
                  <X />
                  关闭
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => closeOtherTabs(item.id)}>关闭其他标签页</ContextMenuItem>
                <ContextMenuItem onSelect={() => closeRightTabs(item.id)}>关闭右侧标签页</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
          <div className="flex h-[var(--browser-tab-height)] w-[var(--browser-tab-height)] shrink-0 items-center justify-center">
            <TabSwitcher
              tabs={tabs.map((item) => ({ ...item, active: item.id === tab.id }))}
              onSelect={(id) => {
                setActive(id)
                setInput(null)
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                data-title="新标签页"
                className="browser-new-tab h-[var(--browser-tab-height)] w-[var(--browser-tab-height)] rounded-t-lg rounded-b-none text-stone-500 hover:bg-stone-200"
                onClick={add} aria-label="新标签页"
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
                data-title="后退"
                disabled={!tab.back}
                onClick={() => withGuest(views.current.get(tab.id), (guest) => guest.goBack())} aria-label="后退"
              >
                <ArrowLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-title="前进"
                disabled={!tab.forward}
                onClick={() => withGuest(views.current.get(tab.id), (guest) => guest.goForward())} aria-label="前进"
              >
                <ArrowRight />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-title={tab.loading ? "停止" : "刷新（F5）"}
                disabled={!tab.url}
                onClick={() => {
                  const view = views.current.get(tab.id)
                  if (tab.loading) withGuest(view, (guest) => guest.stop())
                  else withGuest(view, (guest) => guest.reload())
                }}
              >
                {tab.loading ? <X /> : <RotateCw />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-title="首页"
                onClick={() => {
                  update(tab.id, { ...newTab(), id: tab.id })
                  setInput(null)
                }} aria-label="首页"
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
                <HistoryInput
                  onNavigate={(value, newWindow) => {
                    if (newWindow) {
                      const next = { ...newTab(), url: browserURL(value), loading: true }
                      setTabs((current) => [...current, next])
                      setActive(next.id)
                      setInput(null)
                    } else navigate(value)
                  }}
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
                  data-title="收藏当前页面"
                  aria-label={bookmarks.some((item) => item.url === tab.url) ? "取消书签" : "添加书签"}
                  disabled={!tab.url}
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
                data-title="查看元素信息（Esc 退出，再次点击关闭）"
                aria-label="查看元素信息"
                disabled={!tab.url}
                onClick={() => {
                  void withGuest(views.current.get(tab.id), (guest) => guest.executeJavaScript(elementPickerScript).catch((error) => window.alert(`无法查看元素：${String(error)}`)))
                }}
              >
                <SquareDashedMousePointer />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="加入中转站"
                data-title="加入中转站"
                disabled={!tab.url}
                onClick={() => {
                  try {
                    addTransit(tab.url, tab.title)
                  } catch (error) {
                    window.alert(String(error))
                  }
                }}
              >
                <Pin />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-title="当前网页控制台"
                aria-label="打开当前网页控制台"
                disabled={!tab.url}
                aria-pressed={devtoolsOpen}
                onClick={() => setDevtoolsOpen((open) => !open)}
              >
                <Bug />
              </Button>
              <BrowserExtensions
                onOpenDevtools={() => setDevtoolsOpen(true)}
                getActivePageData={getActivePageData}
              />
              <BrowserMore
                zoomFactor={tab.zoom}
                zoom={zoom}
                onFind={() => setFindOpen(true)}
                onNavigate={navigate}
                guest={() => views.current.get(tab.id)}
                deviceMode={deviceMode}
                onDevice={() => {
                  setDeviceMode((value) => !value)
                }}
              />
            </div>
            <BookmarkBar
              items={bookmarks}
              onNavigate={navigate}
              onRemove={removeBookmark}
              onReset={resetBookmarks}
            />
          </div>
        </div>
        {deviceMode && (
          <DeviceToolbar
            onViewport={setDeviceViewport}
            guest={() => views.current.get(tab.id)}
            tabId={tab.id}
            onClose={() => setDeviceMode(false)}
          />
        )}
        <div className={`browser-content dock-${dock}`}>
          <ResizableSplit
            side={dock === "detached" ? "detached" : dock === "left" ? "left" : dock === "right" ? "right" : "bottom"}
            size={dock === "bottom" ? consoleHeight : consoleWidth}
            min={dock === "bottom" ? 180 : 280}
            max={dock === "bottom" ? window.innerHeight * 0.7 : window.innerWidth * 0.7}
            label={dock === "bottom" ? "调整控制台高度" : "调整网页控制台宽度"}
            onResize={(value) => {
              if (dock === "bottom") {
                setConsoleHeight(value)
                localStorage.setItem("browser-console-height", String(value))
              } else {
                setConsoleWidth(value)
                localStorage.setItem("browser-console-width", String(value))
              }
            }}
            pane={
              devtoolsOpen && tab.url ? (
                <section
                  className="browser-devtools"
                  style={{ height: dock === "detached" ? "auto" : "100%", width: "100%", minHeight: 0 }}
                  aria-label="当前网页控制台"
                >
                  <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-1 text-xs text-stone-500">
                    <span className="mr-auto">网页控制台</span>
                    <select
                      aria-label="控制台停靠位置"
                      value={dock}
                      onChange={(event) => setDock(event.target.value)}
                    >
                      <option value="bottom">底部停靠</option>
                      <option value="left">左侧停靠</option>
                      <option value="right">右侧停靠</option>
                      <option value="detached">独立窗口</option>
                    </select>
                    <select
                      aria-label="控制台字体"
                      value={consoleFont}
                      onChange={(event) => setConsoleFont(event.target.value)}
                    >
                      {["Plus Jakarta Sans", "Menlo", "Consolas", "Courier New", "monospace", "system-ui"].map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </select>
                    <select
                      aria-label="控制台字号（整体缩放）"
                      data-title="字号（整体缩放）"
                      value={consoleSize}
                      onChange={(event) => setConsoleSize(Number(event.target.value))}
                    >
                      {[11, 12, 13, 14, 16, 18, 20].map((size) => (
                        <option
                          key={size}
                          value={size}
                        >
                          {size}px
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label="关闭网页控制台"
                      onClick={() => setDevtoolsOpen(false)}
                    >
                      <X size={14} />
                    </button>
                  </header>
                  <div
                    ref={devtoolsHost}
                    className="min-h-0 flex-1"
                  />
                </section>
              ) : undefined
            }
          >
            <div className="relative h-full min-h-0 min-w-0 flex-1 bg-white">
              {findOpen && (
                <form
                  className="browser-find browser-find-bottom"
                  style={findPosition ? { position: "fixed", left: findPosition.x, top: findPosition.y, right: "auto", bottom: "auto" } : undefined}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).closest("input, button") || event.button !== 0) return
                    event.preventDefault()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    const rect = event.currentTarget.getBoundingClientRect()
                    document.body.classList.add("vessel-find-dragging")
                    findDrag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
                  }}
                  onPointerMove={(event) => {
                    const start = findDrag.current
                    if (!start) return
                    const rect = event.currentTarget.getBoundingClientRect()
                    setFindPosition({ x: Math.max(0, Math.min(innerWidth - rect.width, start.left + event.clientX - start.x)), y: Math.max(0, Math.min(innerHeight - rect.height, start.top + event.clientY - start.y)) })
                  }}
                  onPointerUp={() => {
                    findDrag.current = null
                    document.body.classList.remove("vessel-find-dragging")
                  }}
                  onPointerCancel={() => {
                    findDrag.current = null
                    document.body.classList.remove("vessel-find-dragging")
                  }}
                  aria-label="网页查找"
                  onSubmit={(event) => {
                    event.preventDefault()
                    searchPage(true, true)
                  }}
                >
                  <Search
                    size={15}
                    className="text-stone-400"
                  />
                  <input
                    ref={findInput}
                    aria-label="在网页中查找"
                    placeholder="在网页中查找"
                    spellCheck={false}
                    value={findText}
                    onChange={(event) => setFindText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setFindOpen(false)
                      if (event.key === "Enter" && event.shiftKey) {
                        event.preventDefault()
                        searchPage(false, true)
                      }
                    }}
                  />
                  <span className="browser-find-count">{findResult.tabId === tab.id && findResult.text === findText ? `${findResult.activeMatchOrdinal}/${findResult.matches}` : "0/0"}</span>
                  <button
                    type="button"
                    aria-label="上一个匹配"
                    disabled={!findText || !findResult.matches}
                    onClick={() => searchPage(false, true)}
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="submit"
                    aria-label="下一个匹配"
                    disabled={!findText || !findResult.matches}
                  >
                    <ChevronDown size={15} />
                  </button>
                  <span className="browser-find-divider" />
                  <button
                    type="button"
                    aria-label="区分大小写"
                    aria-pressed={matchCase}
                    onClick={() => setMatchCase((value) => !value)}
                  >
                    Aa
                  </button>
                  <button
                    type="button"
                    className="browser-find-close"
                    aria-label="关闭查找"
                    onClick={() => setFindOpen(false)}
                  >
                    <X size={15} />
                  </button>
                </form>
              )}

              {tab.loading && !tab.ready && (
                <div
                  className="browser-page-loading"
                  role="status"
                  aria-label="正在加载页面"
                >
                  <div className="browser-loading-bar" />
                  <div className="browser-loading-card">
                    <img
                      src={browserLoading}
                      alt=""
                    />
                    <div>
                      正在加载页面
                      <span className="browser-loading-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </div>
                    <small data-title={tab.url}>{tab.url}</small>
                  </div>
                </div>
              )}
              {tab.loading && tab.ready && (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 z-[220] h-1"
                  role="status"
                  aria-label="正在加载页面"
                >
                  <div className="browser-loading-bar" />
                </div>
              )}
              <div className={deviceMode && tab.url ? "device-preview-surface absolute inset-0 overflow-auto p-7" : "absolute inset-0"}>
                <div style={deviceMode && tab.url ? { width: deviceViewport.width + 2, height: deviceViewport.height + 2, margin: "0 auto" } : { width: "100%", height: "100%" }}>
                  <div
                    aria-label={deviceMode ? "设备预览边框" : undefined}
                    style={
                      deviceMode && tab.url
                        ? { width: deviceViewport.width, height: deviceViewport.height, boxSizing: "content-box", border: "1px solid #d6d3d1", borderRadius: 4, boxShadow: "0 8px 32px #0000001a, 0 2px 8px #0000000a", background: "white", overflow: "hidden" }
                        : { width: "100%", height: "100%" }
                    }
                  >
                    <div
                      aria-label={deviceMode ? "设备预览内容" : undefined}
                      style={deviceMode && tab.url ? { width: deviceViewport.width, height: deviceViewport.height, transform: `scale(${deviceViewport.scale})`, transformOrigin: "top left" } : { width: "100%", height: "100%" }}
                    >
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
                    </div>
                  </div>
                </div>
              </div>
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
                    <HistoryInput
                      onNavigate={(value, newWindow) => {
                        if (newWindow) {
                          const next = { ...newTab(), url: browserURL(value), loading: true }
                          setTabs((current) => [...current, next])
                          setActive(next.id)
                          setInput(null)
                        } else navigate(value)
                      }}
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
          </ResizableSplit>
        </div>
        <StatusBar
          className="browser-shared-status"
          left={
            <>
              <button
                aria-label={toolbarCollapsed ? "展开浏览器工具栏" : "折叠浏览器工具栏"}
                aria-expanded={!toolbarCollapsed}
                onClick={() => setToolbarCollapsed((value) => !value)}
                className="shrink-0 rounded p-1 !bg-transparent text-stone-500 hover:!bg-stone-200 hover:text-stone-800"
              >
                {toolbarCollapsed ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
              </button>
              <button
                className="flex shrink-0 items-center gap-1 rounded px-2 py-1 hover:bg-stone-200"
                onClick={() => {
                  setFindPosition(null)
                  setFindOpen(true)
                  requestAnimationFrame(() => findInput.current?.focus())
                }}
              >
                <Search size={13} />
                搜索
              </button>
              <span className="mx-1 h-4 border-l border-stone-300" />
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex min-w-0 max-w-[360px] cursor-default items-center gap-1.5 px-1 font-['Plus_Jakarta_Sans',sans-serif] text-[11.5px] text-stone-500">
                      <Link2
                        size={13}
                        className="shrink-0"
                      />
                      <span className="truncate">{tab.loading ? "正在加载…" : tab.url || "就绪"}</span>
                    </span>
                  </TooltipTrigger>
                  {tab.url ? (
                    <TooltipContent
                      side="top"
                      sideOffset={6}
                      className="max-w-[480px] break-all font-['Plus_Jakarta_Sans',sans-serif] text-xs"
                    >
                      {tab.url}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
            </>
          }
          right={<BrowserProxy showLabel />}
          after={
            <button
              data-title="恢复 100% 缩放"
              aria-label="恢复页面缩放"
              className="ml-2 flex shrink-0 items-center gap-1 border-l border-stone-300 px-2 py-1 hover:bg-stone-200"
              onClick={() => zoom(1 - tab.zoom)}
            >
              <ZoomIn size={13} />
              {Math.round(tab.zoom * 100)}%
            </button>
          }
        />
      </main>
    </Layout>
  )
}
