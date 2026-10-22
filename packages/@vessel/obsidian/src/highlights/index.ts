export interface HighlightMatch {
  start: number
  end: number
  raw: string
  content: string
}

/** Parse paired Obsidian ==markers==, excluding escaped markers and code spans/fences. */
export function parseHighlights(source: string): HighlightMatch[] {
  const matches: HighlightMatch[] = []
  const escaped = (index: number) => {
    let count = 0
    while (index > 0 && source[--index] === "\\") count++
    return count % 2 === 1
  }
  for (let index = 0; index < source.length;) {
    if ((source[index] === "`" || (source[index] === "~" && source.slice(index, index + 3) === "~~~")) && !escaped(index)) {
      const char = source[index]
      let end = index + 1
      while (source[end] === char) end++
      const marker = source.slice(index, end)
      const close = source.indexOf(marker, end)
      index = close < 0 ? source.length : close + marker.length
      continue
    }
    if (source.slice(index, index + 2) !== "==" || source[index - 1] === "=" || source[index + 2] === "=" || escaped(index)) { index++; continue }
    let end = index + 2
    while (end < source.length && source[end] !== "\n" && source[end] !== "\r") {
      if (source.slice(end, end + 2) === "==" && source[end - 1] !== "=" && source[end + 2] !== "=" && !escaped(end)) break
      end++
    }
    if (source.slice(end, end + 2) === "==" && source.slice(index + 2, end).trim()) {
      matches.push({ start: index, end: end + 2, raw: source.slice(index, end + 2), content: source.slice(index + 2, end) })
      index = end + 2
    } else index++
  }
  return matches
}
