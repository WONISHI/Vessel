import { marked } from "marked"
export function headingSections(source: string) {
  let offset = 0
  const headings: { start: number; level: number }[] = []
  marked.walkTokens(marked.lexer(source), token => {
    if (token.type !== "heading") return
    const start = source.indexOf(token.raw, offset)
    if (start < 0) return
    offset = start + token.raw.length
    headings.push({ start, level: token.depth })
  })
  return headings.map((heading, index) => source.slice(heading.start, headings.slice(index + 1).find(next => next.level <= heading.level)?.start ?? source.length))
}
