import type { HistoryEntry } from "@vessel/type"
import { Globe } from "lucide-react"
import { useState } from "react"

/** Renders the site icon component. */
export function SiteIcon({ entry }: { entry: HistoryEntry }) {
  const fallback = new URL("/favicon.ico", entry.url).href
  const [source, setSource] = useState(entry.favicon || fallback)
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center rounded bg-green-50 text-green-600">
      <Globe size={14} />
      {source && (
        <img
          src={source}
          alt=""
          className="absolute size-4 bg-green-50 object-contain"
          onError={() => setSource(source === fallback ? "" : fallback)}
        />
      )}
    </span>
  )
}
