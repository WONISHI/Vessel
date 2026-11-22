import { devServerError } from "@/pages/browser/dev-server-error"
import { browserNavigationError } from "@/pages/browser/navigation-error"
import { guestAppearanceScript } from "@/pages/browser/guest-appearance"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { Tab } from "@/pages/browser/components/index-shared"
import { markGuestReady, withGuest } from "@/pages/browser/guest-lifecycle"
import { pageObserverScript } from "@/pages/browser/page-observer"
import { webviewAttributes } from "@/pages/browser/webview-attributes"
import type { WebviewTag } from "electron"
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

/** Renders the guest component. */
export const Guest = memo(function Guest({ tab, visible, register, update }: { tab: Tab; visible: boolean; register: (id: string, view: WebviewTag | null) => void; update: (id: string, patch: Partial<Tab>) => void }) {
  const dark = useDarkAppearance()
  const ref = useRef<WebviewTag | null>(null)
  const [documentReady, setDocumentReady] = useState(0)
  const zoomRef = useRef(tab.zoom ?? 1)
  const visibleRef = useRef(visible)
  const syncZoom = useCallback(() => {
    if (!visibleRef.current) return
    withGuest(ref.current, guest => {
      const expected = zoomRef.current
      if (Math.abs(guest.getZoomFactor() - expected) > 0.001) guest.setZoomFactor(expected)
    })
  }, [])
  useLayoutEffect(() => {
    zoomRef.current = tab.zoom ?? 1
    visibleRef.current = visible
    syncZoom()
  }, [tab.zoom, visible, syncZoom])
  useEffect(() => {
    const resume = () => { if (!document.hidden) syncZoom() }
    window.addEventListener("focus", resume)
    document.addEventListener("visibilitychange", resume)
    return () => {
      window.removeEventListener("focus", resume)
      document.removeEventListener("visibilitychange", resume)
    }
  }, [syncZoom])
  // Keep expensive theme processing out of first paint and inactive tabs.
  useEffect(() => {
    if (!visible || !documentReady) return
    const timer = window.setTimeout(() => {
      withGuest(ref.current, (view) => void view.executeJavaScript(guestAppearanceScript(dark)).catch((error) => console.warn("网页主题切换失败", error)))
    }, dark ? 150 : 0)
    return () => window.clearTimeout(timer)
  }, [dark, visible, documentReady])
  const [initialURL] = useState(tab.url)
  const [initialAttributes] = useState(() => ({ ...webviewAttributes, webpreferences: `zoomFactor=${tab.zoom}` }))
  const updateRef = useRef(update)
  useEffect(() => {
    updateRef.current = update
  }, [update])
  useEffect(() => {
    const view = ref.current
    if (!view) return

    /** Synchronizes sync. */
    const sync = () => withGuest(view, (guest) => updateRef.current(tab.id, { url: guest.getURL(), title: guest.getTitle() || "正在加载…", back: guest.canGoBack(), forward: guest.canGoForward() }))

    let mediaRevision = 0
    const syncVideoPlaying = () => {
      const revision = ++mediaRevision
      void withGuest(view, (guest) => guest.executeJavaScript(`(() => {
        const floating = document.getElementById("vessel-floating-video")?.shadowRoot?.querySelector("video")
        const playing = (video) => !video.paused && !video.ended
        const videoPlaying = Boolean(floating && playing(floating)) || Array.from(document.querySelectorAll("video")).some(playing)
        return { videoPlaying, mediaPlaying: videoPlaying || Array.from(document.querySelectorAll("audio")).some(playing) }
      })()`).then((playing) => {
        if (revision === mediaRevision) updateRef.current(tab.id, { videoPlaying: playing?.videoPlaying === true, mediaPlaying: playing?.mediaPlaying === true })
      }).catch(() => {}))
    }

    // Navigation can restore Chromium's host zoom; always use the latest tab value,
    // including 100%, both at DOM readiness and after the navigation finishes.
    const applyZoom = syncZoom

    /** Handles ready events. */
    const onReady = () => {
      void view.executeJavaScript(pageObserverScript).catch((error) => console.warn("页面监听注入失败", error))
      markGuestReady(view, true)
      syncVideoPlaying()
      setDocumentReady((revision) => revision + 1)
      syncZoom()
      sync()
      updateRef.current(tab.id, { ready: true })
    }

    /** Starts start. */
    const start = (event: Electron.DidStartNavigationEvent) => {
      if (event.isMainFrame && !event.isInPlace) {
        mediaRevision++
        setDocumentReady(0)
        updateRef.current(tab.id, { loading: true, error: "", devError: undefined, videoPlaying: false, mediaPlaying: false })
      }
    }

    const loading = () => updateRef.current(tab.id, { loading: true, error: "" })

    /** Stops stop. */
    const stop = () => {
      syncZoom()
      sync()
      updateRef.current(tab.id, { loading: false })
    }

    /** Performs the favicon operation. */
    const favicon = (event: Electron.PageFaviconUpdatedEvent) => {
      const url = event.favicons.find((value) => /^https?:\/\//i.test(value) || /^data:image\//i.test(value))
      if (url) updateRef.current(tab.id, { favicon: url })
    }

    /** Performs the fail operation. */
    const fail = (event: Electron.DidFailLoadEvent) => {
      if (event.isMainFrame && event.errorCode !== -3) updateRef.current(tab.id, { loading: false, error: browserNavigationError(event.errorDescription) })
    }

    /** Performs the message operation. */
    const message = (event: Electron.IpcMessageEvent) => {
      if (event.channel === "vessel-focus" || event.channel === "vessel-search-handled") {
        const value = event.args[0]
        if (typeof value === "boolean") view.dataset[event.channel === "vessel-focus" ? "inputFocused" : "pageHandlesSearch"] = String(value)
      }
      if (event.channel === "vessel-favicon") {
        const icon = event.args[0]
        if (typeof icon === "string" && /^(https?:\/\/|data:image\/)/i.test(icon)) updateRef.current(tab.id, { favicon: icon })
      }
      if (event.channel === "vessel-context-menu") {
        const point = event.args[0]
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
          const rect = view.getBoundingClientRect()
          const scale = rect.width / (view.offsetWidth || rect.width || 1)
          window.dispatchEvent(new CustomEvent("vessel-browser-context-menu", { detail: { tabId: tab.id, guestId: view.getWebContentsId(), imageDocument: point.imageDocument === true, x: point.x, y: point.y, left: rect.left + point.x * view.getZoomFactor() * scale, top: rect.top + point.y * view.getZoomFactor() * scale } }))
        }
      }
      if (event.channel === "vessel-inspect-style") {
        const request = event.args[0]
        if (typeof request?.property === "string" && /^[-a-zA-Z0-9_]{1,160}$/.test(request.property) && typeof request.targetKey === "string" && /^__vesselStyleTarget_[a-z0-9]{1,30}$/.test(request.targetKey)) {
          window.dispatchEvent(new CustomEvent("vessel-browser-inspect-style", { detail: { id: view.getWebContentsId(), ...request } }))
        }
      }
      if (event.channel === "vessel-zoom-changed") {
        const zoom = event.args[0]
        if (typeof zoom === "number" && Number.isFinite(zoom) && zoom >= 0.5 && zoom <= 2) {
          zoomRef.current = zoom
          updateRef.current(tab.id, { zoom })
        }
      }
      if (event.channel === "vessel-navigation") sync()
      if (event.channel === "vessel-open-top-search") window.dispatchEvent(new CustomEvent("vessel-browser-open-top-search", { detail: tab.id }))
      if (event.channel === "vessel-find") window.dispatchEvent(new CustomEvent("vessel-browser-find", { detail: view.getWebContentsId() }))
    }
    const consoleMessage = (event: Electron.ConsoleMessageEvent) => {
      const error = devServerError(view.src, event.message, event.level)
      if (error) updateRef.current(tab.id, { devError: error })
    }
    view.addEventListener("focus", syncZoom)
    view.addEventListener("console-message", consoleMessage)
    view.addEventListener("media-started-playing", syncVideoPlaying)
    view.addEventListener("media-paused", syncVideoPlaying)
    view.addEventListener("ipc-message", message)
    view.addEventListener("page-favicon-updated", favicon)
    view.addEventListener("dom-ready", onReady)
    view.addEventListener("did-finish-load", applyZoom)
    view.addEventListener("did-navigate", sync)
    view.addEventListener("did-navigate-in-page", sync)
    view.addEventListener("page-title-updated", sync)
    view.addEventListener("did-start-navigation", start)
    view.addEventListener("did-start-loading", loading)
    view.addEventListener("did-stop-loading", stop)
    view.addEventListener("did-fail-load", fail)
    return () => {
      mediaRevision++
      view.removeEventListener("focus", syncZoom)
      view.removeEventListener("console-message", consoleMessage)
      view.removeEventListener("media-started-playing", syncVideoPlaying)
      view.removeEventListener("media-paused", syncVideoPlaying)
      view.removeEventListener("ipc-message", message)
      markGuestReady(view, false)
      view.removeEventListener("page-favicon-updated", favicon)
      view.removeEventListener("dom-ready", onReady)
      view.removeEventListener("did-finish-load", applyZoom)
      view.removeEventListener("did-navigate", sync)
      view.removeEventListener("did-navigate-in-page", sync)
      view.removeEventListener("page-title-updated", sync)
      view.removeEventListener("did-start-navigation", start)
      view.removeEventListener("did-start-loading", loading)
      view.removeEventListener("did-stop-loading", stop)
      view.removeEventListener("did-fail-load", fail)
    }
  }, [tab.id, syncZoom])
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
      {...initialAttributes}
      style={{ width: "100%", height: "100%", display: visible ? "flex" : "none" }}
    />
  )
})
