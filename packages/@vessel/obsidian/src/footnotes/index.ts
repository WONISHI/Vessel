export interface FootnoteDefinition {
  id: string
  content: string
  start: number
  end: number
}
export interface FootnoteReference {
  id: string
  start: number
  end: number
}
export interface FootnoteAnnotation {
  id: string
  content: string
  start: number
  end: number
}

/** Preserve offsets while excluding fenced/indented code and inline code examples. */
export function parseFootnotes(source: string) {
  let fence = ""
  const masked = source
    .split("\n")
    .map((line) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1]
      if (marker) {
        if (!fence) fence = marker
        else if (marker[0] === fence[0] && marker.length >= fence.length) fence = ""
        return " ".repeat(line.length)
      }
      if (fence || /^(?: {4}|\t)/.test(line)) return " ".repeat(line.length)
      return line.replace(/(`+)[\s\S]*?\1/g, (value) => " ".repeat(value.length))
    })
    .join("\n")
  const definitions: FootnoteDefinition[] = []
  const definitionRanges: Array<[number, number]> = []
  for (const match of masked.matchAll(/^ {0,3}\[\^([^\]\s]+)\]:[^\n]*/gm)) {
    const start = match.index!
    let end = start + match[0].length
    const first = source.slice(start, end).replace(/^ {0,3}\[\^[^\]\s]+\]:[ \t]*/, "")
    const lines = [first]
    let remaining = source.slice(end)
    while (true) {
      const continuation = /^\n((?:[ \t]*\n)*)(?: {4}|\t)([^\n]*)/.exec(remaining)
      if (!continuation) break
      lines.push(...Array.from(continuation[1].matchAll(/\n/g), () => ""), continuation[2])
      end += continuation[0].length
      remaining = source.slice(end)
    }
    definitions.push({ id: match[1], content: lines.join("\n").trim(), start, end })
    definitionRanges.push([start, end])
  }
  const references: FootnoteReference[] = []
  for (const match of masked.matchAll(/\[\^([^\]\s]+)\]/g)) {
    const start = match.index!
    let slashes = 0
    for (let i = start - 1; i >= 0 && source[i] === "\\"; i--) slashes++
    if (slashes % 2 || definitionRanges.some(([from, to]) => start >= from && start < to)) continue
    references.push({ id: match[1], start, end: start + match[0].length })
  }
  const annotations: FootnoteAnnotation[] = []
  for (const match of source.matchAll(/<span\s+data-vessel-footnote="([^"<>\s]+)">([\s\S]*?)<\/span>/g)) {
    const start = match.index!
    if (masked.slice(start, start + 5) !== "<span" || definitionRanges.some(([from, to]) => start >= from && start < to)) continue
    annotations.push({ id: match[1], content: match[2], start, end: start + match[0].length })
  }
  return { definitions, references, annotations }
}
