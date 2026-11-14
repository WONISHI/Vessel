import { Globe } from "lucide-react"

/** Compact browser illustration while the first page is loading. */
export function BrowserLoading({ url }: { url: string }) {
  let website = url
  try {
    const address = new URL(url)
    website = address.protocol === "file:" ? "本地文件" : address.host
  } catch { /* Keep incomplete addresses readable. */ }

  return (
    <div className="browser-loading-content">
      <div className="browser-loading-visual" aria-hidden="true">
        <div className="browser-loading-window">
          <div className="browser-loading-window-top"><i /><i /><i /></div>
          <div className="browser-loading-window-body">
            <Globe />
            <div className="browser-loading-skeleton"><i /><i /><i /></div>
          </div>
          <div className="browser-loading-window-track" />
        </div>
      </div>
      <strong>正在打开页面</strong>
      <small data-title={url}>{website || "正在连接…"}</small>
    </div>
  )
}
