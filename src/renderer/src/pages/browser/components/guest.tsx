import { guestAppearanceScript } from "@/pages/browser/guest-appearance"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { Tab } from "@/pages/browser/components/index-shared"
import { markGuestReady, withGuest } from "@/pages/browser/guest-lifecycle"
import { pageObserverScript } from "@/pages/browser/page-observer"
import { webviewAttributes } from "@/pages/browser/webview-attributes"
import type { WebviewTag } from "electron"
import { memo, useCallback, useEffect, useRef, useState } from "react"

/** Renders the guest component. */
export const Guest = memo(function Guest({ tab, visible, register, update }: { tab: Tab; visible: boolean; register: (id: string, view: WebviewTag | null) => void; update: (id: string, patch: Partial<Tab>) => void }) {
  const dark = useDarkAppearance()
  const ref = useRef<WebviewTag | null>(null)
  const [documentReady, setDocumentReady] = useState(0)
  // Keep expensive theme processing out of first paint and inactive tabs.
  useEffect(() => {
    if (!visible || !documentReady) return
    const timer = window.setTimeout(() => {
      withGuest(ref.current, (view) => void view.executeJavaScript(guestAppearanceScript(dark)).catch((error) => console.warn("网页主题切换失败", error)))
    }, dark ? 150 : 0)
    return () => window.clearTimeout(timer)
  }, [dark, visible, documentReady])
  const [initialURL] = useState(tab.url)
  const updateRef = useRef(update)
  useEffect(() => {
    updateRef.current = update
  }, [update])
  useEffect(() => {
    const view = ref.current
    if (!view) return

    /** Synchronizes sync. */
    const sync = () => withGuest(view, (guest) => updateRef.current(tab.id, { url: guest.getURL(), title: guest.getTitle() || "正在加载…", back: guest.canGoBack(), forward: guest.canGoForward() }))

    /** Handles ready events. */
    const onReady = () => {
      void view.executeJavaScript(pageObserverScript).catch((error) => console.warn("页面监听注入失败", error))
      markGuestReady(view, true)
      setDocumentReady((revision) => revision + 1)
      if (tab.zoom && tab.zoom !== 1) {
        try {
          view.setZoomFactor(tab.zoom)
        } catch {}
      }
      sync()
      updateRef.current(tab.id, { loading: false, ready: true })
    }

    /** Starts start. */
    const start = (event: Electron.DidStartNavigationEvent) => {
      if (event.isMainFrame && !event.isInPlace) {
        setDocumentReady(0)
        updateRef.current(tab.id, { loading: true, error: "" })
      }
    }

    /** Stops stop. */
    const stop = () => {
      sync()
      updateRef.current(tab.id, { loading: false })
    }

    /** Performs the favicon operation. */
    const favicon = (event: Electron.PageFaviconUpdatedEvent) => {
      const url = event.favicons.find((value) => /^https?:\/\//i.test(value) || /^data:image\//i.test(value))
      updateRef.current(tab.id, { favicon: url })
    }

    /** Performs the fail operation. */
    const fail = (event: Electron.DidFailLoadEvent) => {
      if (event.isMainFrame && event.errorCode !== -3) updateRef.current(tab.id, { loading: false, error: `页面加载失败：${event.errorDescription}` })
    }

    /** Performs the message operation. */
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
  return (
    <webview
      ref={useCallback(
        (view: WebviewTag | null) => {
          ref.current = view
          register(tab.id, view)
        },
        [register, tab.id]
      )}
      src={initialURL}
      {...webviewAttributes}
      style={{ width: "100%", height: "100%", display: visible ? "flex" : "none" }}
    />
  )
})
