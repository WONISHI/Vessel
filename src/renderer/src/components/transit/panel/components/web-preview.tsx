import { type TransitItem } from "@/components/transit/state"
import { webviewAttributes } from "@/pages/browser/webview-attributes"
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

/** Renders the web preview component. */
export function WebPreview({ item }: { item: TransitItem }) {
  const ref = useRef<Electron.WebviewTag>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [address, setAddress] = useState(item.content)
  const [history, setHistory] = useState({ back: false, forward: false })
  useEffect(() => {
    const view = ref.current
    if (!view) return

    /** Refreshes the current state. */
    const update = () => {
      setReady(true)
      setAddress(view.getURL())
      setHistory({ back: view.canGoBack(), forward: view.canGoForward() })
    }

    /** Performs the emulate operation. */
    const emulate = () => {
      if (item.preview) void window.electronAPI.emulateBrowserDevice(view.getWebContentsId(), item.preview.device).catch((e) => setError(String(e)))
    }
    view.addEventListener("dom-ready", emulate)

    /** Starts start. */
    const start = () => {
      setError("")
    }

    /** Performs the fail operation. */
    const fail = (event: Event) => {
      const e = event as Electron.DidFailLoadEvent
      if (e.isMainFrame && e.errorCode !== -3) setError(`网页加载失败：${e.errorDescription}`)
    }
    view.addEventListener("dom-ready", update)
    view.addEventListener("did-navigate", update)
    view.addEventListener("did-navigate-in-page", update)
    view.addEventListener("did-start-loading", start)
    view.addEventListener("did-fail-load", fail)
    return () => {
      view.removeEventListener("dom-ready", emulate)
      view.removeEventListener("dom-ready", update)
      view.removeEventListener("did-navigate", update)
      view.removeEventListener("did-navigate-in-page", update)
      view.removeEventListener("did-start-loading", start)
      view.removeEventListener("did-fail-load", fail)
    }
  }, [item.preview])

  /** Performs the act operation. */
  const act = (action: "goBack" | "goForward" | "reload") => {
    try {
      if (ready) ref.current?.[action]()
    } catch (error) {
      toast.error(String(error))
    }
  }
  return (
    <>
      <div className="flex items-center gap-2 border-b bg-stone-50 px-3 py-2 text-stone-400">
        <button
          aria-label="后退"
          disabled={!ready || !history.back}
          onClick={() => act("goBack")}
          className="disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          aria-label="前进"
          disabled={!ready || !history.forward}
          onClick={() => act("goForward")}
          className="disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          aria-label="刷新"
          disabled={!ready}
          onClick={() => act("reload")}
        >
          <RotateCw className="size-4" />
        </button>
        <span className="min-w-0 flex-1 truncate rounded-md border bg-white px-2 py-1 text-xs">{address}</span>
      </div>
      {error && (
        <div
          role="alert"
          className="bg-red-50 p-3 text-xs text-red-700"
        >
          {error}
        </div>
      )}
      {!ready && !error && (
        <p
          role="status"
          className="p-3 text-xs text-stone-400"
        >
          正在加载网页…
        </p>
      )}
      <div className={`min-h-0 flex-1 ${item.preview ? "overflow-auto bg-stone-100 p-4" : "flex"}`}>
        <div style={item.preview ? { width: item.preview.device.width, height: item.preview.device.height, margin: "0 auto", overflow: "hidden", border: "1px solid #d6d3d1", boxSizing: "content-box", borderRadius: 4, background: "white" } : { width: "100%", height: "100%" }}>
          <div style={item.preview ? { width: item.preview.device.width, height: item.preview.device.height, transform: `scale(${item.preview.scale})`, transformOrigin: "top left" } : { width: "100%", height: "100%" }}>
            <webview
              ref={ref}
              src={item.content}
              {...webviewAttributes}
              style={{ width: "100%", height: "100%", display: "flex" }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
