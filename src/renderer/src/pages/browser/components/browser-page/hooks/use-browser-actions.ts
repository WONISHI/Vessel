import { browserNavigationError } from "@/pages/browser/navigation-error"
import { newTab, Tab } from "@/pages/browser/components/index-shared"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import { browserURL } from "@/pages/browser/url"
import { matchesShortcut } from "@vessel/utils"
import { useCallback, useEffect, useRef, useState } from "react"
import type { BrowserState } from "@/pages/browser/components/browser-page/hooks/use-browser-state"

/** 页内查找、控制台挂载、导航与标签操作 */
export function useBrowserActions(state: BrowserState, visible: boolean) {
  const { tabs, setTabs, findOpen, setFindOpen, matchCase, findText, setFindResult, findInput, devtoolsOpen, setDevtoolsOpen, dock, consoleFont, consoleSize, devtoolsHost, setActive, setInput, bookmarks, setBookmarks, views, tab } = state


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
        if (!event.repeat) setDevtoolsOpen((open) => !open)
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
        const updated = { ...current[index], ...patch }
        next[index] = updated.url ? updated : { ...updated, favicon: undefined }
        return next
      }),
    []
  )
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

    /** Synchronizes sync. */
    const sync = () => {
      const { x, y, width, height } = element.getBoundingClientRect()
      try {
        void window.electronAPI.setBrowserDevtools(view.getWebContentsId(), { x, y, width, height }, { font: consoleFont, size: consoleSize, detached: dock === "detached", hidden: !visible }).catch((error) => {
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
      // Defer closing so a dock/font change reuses the open DevTools instead of tearing it down and reopening (which left it blank).
      devtoolsCloseTimer.current = setTimeout(() => void window.electronAPI.setBrowserDevtools(null).catch(() => {}), 80)
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
        })
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

  return { searchPage, update, navigate, add, close, addTabRightOf, reloadTab, togglePinTab, closeOtherTabs, closeRightTabs, dragTabId, setDragTabId, reorderTabs, zoom, bookmark }
}
