import { Globe } from "lucide-react"
import { useState } from "react"

/** Renders the bookmark icon component. */
export function BookmarkIcon({ url, favicon }: { url: string; favicon?: string }) {
  const [failed, setFailed] = useState(false)
  let iconUrl = favicon
  if (!iconUrl && url && /^https?:\/\//i.test(url)) {
    try {
      iconUrl = `${new URL(url).origin}/favicon.ico`
    } catch {}
  }
  if (!iconUrl || failed) {
    return (
      <Globe
        size={12}
        className="shrink-0 text-stone-400"
      />
    )
  }
  return (
    <img
      src={iconUrl}
      alt=""
      className="size-3.5 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  )
}
