export interface MarkdownTag {
  /** Full source spelling, including #. */
  raw: string
  name: string
  start: number
  end: number
}

/** Parses Unicode and nested tags while excluding fenced/indented code and inline code. */
export function parseMarkdownTags(source: string): MarkdownTag[] {
  const excluded: { start: number; end: number }[] = []
  let fence: { char: string; length: number; start: number } | undefined
  let offset = 0
  for (const line of source.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && /^\s*$/.test(line.slice(marker[0].length))) {
        excluded.push({ start: fence.start, end: offset + line.length })
        fence = undefined
      }
    } else if (marker) fence = { char: marker[1][0], length: marker[1].length, start: offset }
    else if (/^(?: {4}|\t)/.test(line)) excluded.push({ start: offset, end: offset + line.length })
    offset += line.length
  }
  if (fence) excluded.push({ start: fence.start, end: source.length })
  for (let i = 0; i < source.length; i++) {
    const block = excluded.find((range) => i >= range.start && i < range.end)
    if (block) { i = block.end - 1; continue }
    if (source[i] !== "`") continue
    let length = 1
    while (source[i + length] === "`") length++
    let end = source.indexOf("`".repeat(length), i + length)
    while (end >= 0 && (source[end - 1] === "`" || source[end + length] === "`")) end = source.indexOf("`".repeat(length), end + length)
    if (end >= 0) { excluded.push({ start: i, end: end + length }); i = end + length - 1 }
    else i += length - 1
  }
  const result: MarkdownTag[] = []
  for (const match of source.matchAll(/(^|[\s（(\[，,。;；])(#(?:[\p{L}\p{N}_-]+)(?:\/[\p{L}\p{N}_-]+)*)/gu)) {
    const start = match.index! + match[1].length, raw = match[2], end = start + raw.length
    if (excluded.some((range) => start < range.end && end > range.start)) continue
    if (/^#[\d/]+$/.test(raw)) continue
    result.push({ raw, name: raw.slice(1), start, end })
  }
  return result
}
