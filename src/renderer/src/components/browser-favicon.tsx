import { Globe } from "lucide-react"
import { useState } from "react"

/** Keep a failed icon local to its URL, and try the site's conventional icon before the globe. */
export function BrowserFavicon({ url, favicon }: { url?: string; favicon?: string }) {
  const [loaded, setLoaded] = useState<string>()
  const [failed, setFailed] = useState<string[]>([])
  let fallback: string | undefined
  try {
    const page = new URL(url || "")
    if (["http:", "https:"].includes(page.protocol)) fallback = new URL("/favicon.ico", page).href
  } catch {}
  const source = url ? [favicon, fallback].find((value) => value && !failed.includes(value)) : undefined
  return (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      {(!source || loaded !== source) && <Globe size={14} className="text-green-600" />}
      {source && (
        <img
          key={source}
          src={source}
          alt=""
          className={`absolute inset-0 size-4 object-contain ${loaded === source ? "" : "invisible"}`}
          onLoad={() => setLoaded(source)}
          onError={() => setFailed((previous) => [...previous, source])}
        />
      )}
    </span>
  )
}
