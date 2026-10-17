import { marked } from "marked"

/** Performs the heading sections operation. */
export function headingSections(source: string) {
  let offset = 0
  const headings: { start: number; level: number }[] = []
  marked.walkTokens(marked.lexer(source), (token) => {
    if (token.type !== "heading") return
    let start = source.indexOf(token.raw, offset)
    let length = token.raw.length
    if (start < 0) {
      // Marked strips blockquote prefixes from child tokens, so their full raw text is not in the source.
      const firstLine = token.raw.split("\n")[0].trimEnd()
      let candidate = source.indexOf(firstLine, offset)
      while (firstLine && candidate >= 0) {
        const lineStart = source.lastIndexOf("\n", candidate - 1) + 1
        if (/^[ \t]*(?:>[ \t]*)+$/.test(source.slice(lineStart, candidate))) {
          start = lineStart
          length = candidate + firstLine.length - lineStart
          break
        }
        candidate = source.indexOf(firstLine, candidate + firstLine.length)
      }
    }
    if (start < 0) return
    offset = start + length
    headings.push({ start, level: token.depth })
  })
  return headings.map((heading, index) => source.slice(heading.start, headings.slice(index + 1).find((next) => next.level <= heading.level)?.start ?? source.length))
}
