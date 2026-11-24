import { browserNavigationError } from "@/pages/browser/navigation-error"
import { browserPopupOverlapsPane } from "@/pages/browser/popup-overlap"
import { newTab, Tab } from "@/pages/browser/components/index-shared"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import { browserURL } from "@/pages/browser/url"
import { matchesShortcut } from "@vessel/utils"
import { useCallback, useEffect, useRef, useState } from "react"
import { useBrowserFind } from "./use-browser-find"
import type { BrowserState } from "@/pages/browser/components/browser-page/hooks/use-browser-state"

/** 页内查找、控制台挂载、导航与标签操作 */
export function useBrowserActions(state: BrowserState, visible: boolean) {
  const { tabs, setTabs, setAllTabs, setFindOpen, setFindPosition, setToolbarCollapsed, toolbarCollapsed, findInput, devtoolsOpen, setDevtoolsOpen, dock, consoleFont, consoleSize, devtoolsHost, setActive, setInput, bookmarks, setBookmarks, views, tab, input } = state


  /** Reloads tab. */
  const reloadTab = (id: string) => {
    if (tabs.find((item) => item.id === id)?.frozen) { setActive(id); return }
    const view = views.current.get(id)
    if (!view?.isConnected) return
    try {
      void window.electronAPI.reloadBrowserTab(view.getWebContentsId()).catch((error) => console.error("刷新浏览器标签失败", error))
    } catch (error) { console.error("刷新浏览器标签失败", error) }
  }

  useEffect(() => {
    if (!visible) return
    const publish = () => window.dispatchEvent(new CustomEvent("vessel-browser-toolbar-state", { detail: toolbarCollapsed }))
    publish()
    window.addEventListener("vessel-browser-request-toolbar-state", publish)
    return () => window.removeEventListener("vessel-browser-request-toolbar-state", publish)
  }, [visible, toolbarCollapsed])
  const searchPage = useBrowserFind(state, visible)
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
        if (!event.repeat) setDevtoolsOpen((open) => !open)
      }
      if (matchesShortcut(event, "refreshBrowser")) {
        event.preventDefault()
        if (!event.repeat) refreshCurrentTab()
      }
    }
    window.addEventListener("keydown", keydown, true)
    const refreshCurrentTab = () => reloadTab(tab.id)
    window.addEventListener("vessel-browser-refresh", refreshCurrentTab)


    /** Performs the page find operation. */
    const pageFind = (event: Event) => {
      if (withGuest(views.current.get(tab.id), (guest) => guest.getWebContentsId()) === (event as CustomEvent<number>).detail) show()
    }
    const toggleToolbar = () => setToolbarCollapsed(value => !value)
    const openFind = () => { setFindPosition(null); show() }
    window.addEventListener("vessel-browser-toggle-toolbar", toggleToolbar)
    window.addEventListener("vessel-browser-open-find", openFind)
    window.addEventListener("vessel-browser-find", pageFind)
    const stopDevtools = window.electronAPI.onBrowserToggleDevtools?.((id) => {
      if (withGuest(views.current.get(tab.id), (guest) => guest.getWebContentsId()) === id) setDevtoolsOpen((open) => !open)
    })
    const unsubscribe = window.electronAPI.onBrowserFind((id) => {
      if (withGuest(views.current.get(tab.id), (guest) => guest.getWebContentsId()) === id) show()
    })
    return () => {
      window.removeEventListener("keydown", keydown, true)
      window.removeEventListener("vessel-browser-refresh", refreshCurrentTab)
      window.removeEventListener("vessel-browser-toggle-toolbar", toggleToolbar)
      window.removeEventListener("vessel-browser-open-find", openFind)
      window.removeEventListener("vessel-browser-find", pageFind)
      stopDevtools?.()
      unsubscribe()
    }
  }, [visible, tab.id])

  /** Refreshes the current state. */
  const update = useCallback(
    (id: string, patch: Partial<Tab>) =>
      setAllTabs((current) => {
        const index = current.findIndex((item) => item.id === id)
        if (index < 0 || (Object.keys(patch) as (keyof Tab)[]).every((key) => current[index][key] === patch[key])) return current
        const next = [...current]
        const updated = { ...current[index], ...patch }
        next[index] = updated.url ? updated : { ...updated, favicon: undefined }
        return next
      }),
    []
  )
  const pendingInspect = useRef<{ x: number; y: number; property?: string; targetKey?: string } | undefined>(undefined)
  const [inspectRevision, setInspectRevision] = useState(0)
  const inspectPage = (point: { x: number; y: number; property?: string; targetKey?: string }) => {
    pendingInspect.current = point
    setDevtoolsOpen(true)
    setInspectRevision((revision) => revision + 1)
  }
  useEffect(() => {
    const inspect = (event: Event) => {
      const request = (event as CustomEvent<{ id: number; property: string; targetKey: string }>).detail
      if (!visible || withGuest(views.current.get(tab.id), guest => guest.getWebContentsId()) !== request.id) return
      inspectPage({ x: 0, y: 0, property: request.property, targetKey: request.targetKey })
    }
    window.addEventListener("vessel-browser-inspect-style", inspect)
    return () => window.removeEventListener("vessel-browser-inspect-style", inspect)
  }, [visible, tab.id])
  const devtoolsCloseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    const element = devtoolsHost.current
    const view = views.current.get(tab.id)
    clearTimeout(devtoolsCloseTimer.current)
    if (!devtoolsOpen || !element || !view) {
      void window.electronAPI.setBrowserDevtools(null).catch(() => {})
      return
    }
    let disposed = false

    const hasPopup = () => browserPopupOverlapsPane(element.getBoundingClientRect())
    let popupOpen = hasPopup()
    /** Synchronizes sync. */
    const sync = () => {
      const { x, y, width, height } = element.getBoundingClientRect()
      const control = document.querySelector<HTMLElement>('[data-vessel-control="true"]')
      const button = control?.querySelector("button")
      const rect = button?.getBoundingClientRect()
      const style = button && getComputedStyle(button)
      const controlOverlay = control && !control.hidden && rect && style && dock !== "detached" ? {
        x: rect.x - x, y: rect.y - y, width: rect.width, height: rect.height,
        icon: button.querySelector("svg")?.outerHTML || "", color: style.color,
        background: style.backgroundColor, border: style.borderColor, shadow: style.boxShadow
      } : undefined
      try {
        const inspect = pendingInspect.current
        pendingInspect.current = undefined
        void window.electronAPI.setBrowserDevtools(view.getWebContentsId(), { x, y, width, height }, { font: consoleFont, size: consoleSize, detached: dock === "detached", hidden: !visible || (dock !== "detached" && popupOpen), occluded: visible && dock !== "detached" && popupOpen, pageTitle: tab.title, pageURL: input ?? tab.url, inspect, control: controlOverlay }).catch((error) => {
          if (!disposed) {
            update(tab.id, { error: String(error) })
            setDevtoolsOpen(false)
          }
        })
      } catch {
        /* guest 尚未完成挂载，dom-ready 后重试。 */
      }
    }
    // Native WebContentsViews sit above DOM portals, irrespective of CSS z-index.
    let syncFrame = 0
    const popupObserver = new MutationObserver((mutations) => {
      const next = hasPopup()
      const controlChanged = mutations.some(({ target }) => target instanceof Element && target.closest('[data-vessel-control="true"]'))
      if (next === popupOpen && !controlChanged) return
      popupOpen = next
      cancelAnimationFrame(syncFrame)
      syncFrame = requestAnimationFrame(sync)
    })
    popupObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "data-visible", "data-removed", "data-mounted", "class", "style", "hidden"] })
    const observer = new ResizeObserver(sync)
    observer.observe(element)
    view.addEventListener("dom-ready", sync)
    window.addEventListener("resize", sync)
    sync()
    return () => {
      disposed = true
      observer.disconnect()
      popupObserver.disconnect()
      cancelAnimationFrame(syncFrame)
      view.removeEventListener("dom-ready", sync)
      window.removeEventListener("resize", sync)
      // Defer closing so a dock/font change reuses the open DevTools instead of tearing it down and reopening (which left it blank).
      devtoolsCloseTimer.current = setTimeout(() => void window.electronAPI.setBrowserDevtools(null).catch(() => {}), 80)
    }
  }, [visible, devtoolsOpen, tab.id, tab.url, tab.title, input, dock, consoleFont, consoleSize, inspectRevision])

  /** Performs the navigate operation. */
  const navigate = (value: string) => {
    try {
      const url = browserURL(value)
      if (!url) return
      const view = views.current.get(tab.id)
      update(tab.id, { url, loading: true, error: "" })
      setInput(null)
      if (view) void view.loadURL(url).catch((error) => {
        const message = browserNavigationError(error)
        if (message) update(tab.id, { error: message, loading: false })
      })
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
        setTabs((current) => {
          const openerIndex = current.findIndex((tab) => tab.id === item.openerId)
          if (openerIndex === -1) return [...current, item]
          const insertAt = openerIndex + 1
          return [...current.slice(0, insertAt), item, ...current.slice(insertAt)]
        }, item.openerId)
        setActive(item.id)
        setInput(null)
      }),
    []
  )

  /** Remove a group in one state update so successive single-tab closes cannot restore members. */
  const closeTabs = (ids: string[]) => {
    const removed = new Set(ids)
    if (!tabs.some((item) => removed.has(item.id))) return
    const remaining = tabs.filter((item) => !removed.has(item.id))
    if (!remaining.length) remaining.push(newTab())
    setTabs(remaining)
    if (removed.has(tab.id)) {
      const previous = tabs.slice(0, tabs.findIndex((item) => item.id === tab.id)).filter((item) => !removed.has(item.id)).at(-1)
      setActive(remaining.find((item) => item.id === tab.openerId)?.id || previous?.id || remaining[0].id)
      setInput(null)
    }
  }
  const close = (id: string) => closeTabs([id])

  /** Adds tab right of. */
  const addTabRightOf = (targetId: string, duplicate = false) => {
    const source = duplicate ? tabs.find((item) => item.id === targetId) : undefined
    if (duplicate && !source) return
    const item: Tab = source
      ? { ...newTab(), url: source.url, title: source.title, favicon: source.favicon, zoom: source.zoom, loading: !!source.url, openerId: source.id }
      : newTab()
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

  /** Toggles pin tab. */
  const togglePinTab = (id: string | string[]) => {
    const ids = new Set(Array.isArray(id) ? id : [id])
    setTabs((current) => {
      const pinned = !current.filter((item) => ids.has(item.id)).every((item) => item.pinned)
      return current.map((item) => ids.has(item.id) ? { ...item, pinned } : item)
    })
  }

  /** Closes other tabs. */
  const closeOtherTabs = (id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id]
    if (!ids.length) return
    setTabs((current) => current.filter((item) => ids.includes(item.id) || item.pinned))
    setActive(ids[0])
    setInput(null)
  }

  /** Closes right tabs. */
  const closeRightTabs = (id: string) => {
    const index = tabs.findIndex((item) => item.id === id)
    if (index < 0) return
    const remaining = tabs.filter((item, position) => position <= index || item.pinned)
    setTabs(remaining)
    if (!remaining.some((item) => item.id === tab.id)) {
      setActive(id)
      setInput(null)
    }
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
      const detail = (event as CustomEvent<{ action: string; id: string; url?: string }>).detail
      if (detail.action === "new" && detail.url) {
        const item = { ...newTab(), url: detail.url, loading: true }
        setTabs((current) => {
          const index = current.findIndex((entry) => entry.id === tab.id)
          const position = index < 0 ? current.length : index + 1
          return [...current.slice(0, position), item, ...current.slice(position)]
        })
        setActive(item.id)
        setInput(null)
      } else if (detail.action === "new") add()
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

  return { inspectPage, searchPage, update, navigate, add, close, closeTabs, addTabRightOf, reloadTab, togglePinTab, closeOtherTabs, closeRightTabs, dragTabId, setDragTabId, reorderTabs, zoom, bookmark }
}
