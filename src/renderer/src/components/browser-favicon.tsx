import { Globe } from "lucide-react"
import { useState } from "react"

/** Keep a failed icon local to its URL, and try the site's conventional icon before the globe. */
export function BrowserFavicon({ url, favicon }: { url?: string; favicon?: string }) {
  const [failed, setFailed] = useState<string[]>([])
  let fallback: string | undefined
  try {
    const page = new URL(url || "")
    if (["http:", "https:"].includes(page.protocol)) fallback = new URL("/favicon.ico", page).href
  } catch {}
  const source = [favicon, fallback].find((value) => value && !failed.includes(value))
  return source ? (
    <img key={source} src={source} alt="" className="size-4 shrink-0 object-contain" onError={() => setFailed((previous) => [...previous, source])} />
  ) : <Globe size={14} className="shrink-0 text-green-600" />
}
