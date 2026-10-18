import type { ContentMatch } from "@vessel/type"

/** Keeps the matched term visible while context yields space on narrow panels. */
export function Highlight({ match }: { match: ContentMatch }) {
  const range = match.ranges[0]
  if (!range) return <span className="search-snippet-after">{match.text}</span>
  const before = match.text.slice(0, range.start)
  const after = match.text.slice(range.end)
  return (
    <span className="search-snippet">
      {before && <span className="search-snippet-before">{before}</span>}
      <mark>{match.text.slice(range.start, range.end) || "▏"}</mark>
      {after && <span className="search-snippet-after">{after}</span>}
    </span>
  )
}
