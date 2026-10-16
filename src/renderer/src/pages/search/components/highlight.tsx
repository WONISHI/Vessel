import type { ContentMatch } from "@vessel/type"

/** Renders the highlight component. */
export function Highlight({ match }: { match: ContentMatch }) {
  let end = 0
  const parts: React.ReactNode[] = []
  match.ranges.forEach((range, index) => {
    parts.push(match.text.slice(end, range.start), <mark key={index}>{match.text.slice(range.start, range.end)}</mark>)
    end = range.end
  })
  parts.push(match.text.slice(end))
  return <>{parts}</>
}
