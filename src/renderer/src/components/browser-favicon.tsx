import { Globe } from "lucide-react"
import { useState, type ReactNode } from "react"

/** Keep a failed icon local to its URL, and try the site's conventional icon before the globe. */
export function BrowserFavicon({ url, favicon, frozen = false, icon }: { url?: string; favicon?: string; frozen?: boolean; icon?: ReactNode }) {
  const [loaded, setLoaded] = useState<string>()
  const [failed, setFailed] = useState<string[]>([])
  let fallback: string | undefined
  try {
    const page = new URL(url || "")
    if (["http:", "https:"].includes(page.protocol)) fallback = new URL("/favicon.ico", page).href
  } catch { /* Blank and local pages use the default globe. */ }
  const source = !icon && url ? [favicon, fallback].find((value) => value && !failed.includes(value)) : undefined
  return (
    <span aria-label={frozen ? "标签页已冷冻，点击后重新加载" : undefined} data-frozen={frozen || undefined} className="relative inline-flex size-4 shrink-0 items-center justify-center">
      {frozen && <svg aria-hidden="true" data-frozen-ring className="pointer-events-none absolute text-stone-400 dark:text-stone-500" style={{ width: 24, height: 24, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4.5" strokeLinecap="round" />
      </svg>}
      {icon ?? ((!source || loaded !== source) && <Globe size={14} className="text-green-600" />)}
      {source && (
        <img
          data-browser-favicon=""
          key={source}
          src={source}
          alt=""
          className={`absolute inset-0 size-4 object-contain ${loaded === source ? "" : "invisible"}`}
          onLoad={() => { setLoaded(source); requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("vessel-favicon-loaded", { detail: source }))) }}
          onError={() => setFailed((previous) => [...previous, source])}
        />
      )}
    </span>
  )
}
