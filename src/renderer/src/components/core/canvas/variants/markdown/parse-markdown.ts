import { marked, type Token, type Tokens } from "marked"

export interface DocumentHeading {
  id: string
  text: string
  level: number
}
/** 解析 Markdown，生成内容和大纲共同使用的稳定标题标识。 */
export function parseMarkdownDocument(content: string) {
  const tokens = marked.lexer(content, { gfm: true })
  const headings: DocumentHeading[] = []
  const headingIds = new Map<Token, string>()
  marked.walkTokens(tokens, (token) => {
    if (token.type === "heading") {
      const heading = token as Tokens.Heading
      const id = `markdown-heading-${headings.length}`
      headingIds.set(token, id)
      headings.push({ id, text: heading.text.replace(/[*`_]/g, ""), level: heading.depth })
    }
  })
  return { tokens, headings, headingIds }
}
