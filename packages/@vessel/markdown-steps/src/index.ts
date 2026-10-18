import { Lexer, Parser, Renderer, type Token, type Tokens } from "marked"
export type StepsMode = "steps" | "timeline"

/** Escapes source text before inserting it into an HTML preview. */
export function escapeStepsText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const inlineTags = new Set(["a", "font", "span", "u", "b", "strong", "i", "em", "s", "del", "mark", "small", "sub", "sup", "br"])

/** Accepts literal CSS colors without URLs, variables or executable expressions. */
function safeColor(value: string): boolean {
  return /^(#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d.,%\s+/-]+\))$/i.test(value)
}

/** Keeps the same common inline formatting as the Markdown editor. */
function renderInlineHTML(source: string): string {
  const match = source.match(/^<(\/?)([a-z]+)\b([^<>]*?)(\/?)>$/i)
  if (!match || !inlineTags.has(match[2].toLowerCase())) return escapeStepsText(source)
  const [, closing, rawTag, attributes] = match
  const tag = rawTag.toLowerCase()
  if (closing) return tag === "br" ? "" : `</${tag}>`
  const styles: string[] = []
  let href = ""
  for (const attribute of attributes.matchAll(/([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)) {
    const name = attribute[1].toLowerCase()
    const value = (attribute[2] ?? attribute[3] ?? attribute[4]).trim()
    if (name === "color" && tag === "font" && safeColor(value)) styles.push(`color:${value}`)
    if (name === "href" && tag === "a" && /^(https?:|mailto:|#)/i.test(value)) href = value
    if (name !== "style") continue
    for (const declaration of value.split(";")) {
      const colon = declaration.indexOf(":")
      if (colon < 0) continue
      const property = declaration.slice(0, colon).trim().toLowerCase()
      const setting = declaration.slice(colon + 1).trim()
      const allowed = (["color", "background-color"].includes(property) && safeColor(setting))
        || (property === "font-weight" && /^(normal|bold|bolder|lighter|[1-9]00)$/i.test(setting))
        || (property === "font-style" && /^(normal|italic|oblique)$/i.test(setting))
        || (property === "text-decoration" && /^(none|underline|line-through|overline)(\s+(underline|line-through|overline))*$/i.test(setting))
        || (property === "font-size" && /^(small|smaller|medium|large|larger|\d{1,2}(?:\.\d+)?(?:px|em|rem|%))$/i.test(setting))
      if (allowed) styles.push(`${property}:${setting}`)
    }
  }
  return `<${tag}${styles.length ? ` style="${escapeStepsText(styles.join(";"))}"` : ""}${href ? ` href="${escapeStepsText(href)}" rel="noopener noreferrer"` : ""}>`
}

/** Uses lists as nodes and attaches surrounding Markdown blocks to their descriptions. */
export function parseSteps(source: string): Tokens.ListItem[] {
  const blocks = Lexer.lex(source)
  const items: Tokens.ListItem[] = []
  const leading: Token[] = []
  for (const block of blocks) {
    if (block.type === "space" || block.type === "def") continue
    if (block.type === "list") {
      const next = (block as Tokens.List).items
      if (!items.length && leading.length && next.length) next[0].tokens.splice(1, 0, ...leading)
      items.push(...next)
    } else if (items.length) {
      items[items.length - 1].tokens.push(block)
    } else {
      leading.push(block)
    }
  }
  if (!items.length) throw new Error("请使用至少一个有序或无序列表项作为节点；节点说明支持 Markdown 语法。")
  return items
}

/** Renders Markdown and allowed inline HTML without executable attributes or unsafe links. */
export function renderSteps(source: string, mode: StepsMode = "steps"): string {
  const items = parseSteps(source)
  const renderer = new Renderer()
  renderer.html = ({ text }) => renderInlineHTML(text)
  renderer.link = function ({ href, tokens }) {
    const label = this.parser.parseInline(tokens)
    if (!/^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(href)) return label
    return `<a href="${escapeStepsText(href)}" rel="noopener noreferrer">${label}</a>`
  }
  renderer.image = ({ text }) => escapeStepsText(text)
  const options = { renderer }
  const rows = items
    .map((item, index) => {
      const [heading, ...body] = item.tokens
      const title = heading && (heading.type === "text" || heading.type === "paragraph") ? heading.text : item.text
      return `<li class="vessel-step"><span class="vessel-step-marker" aria-hidden="true">${mode === "steps" ? index + 1 : ""}</span><div class="vessel-step-content"><div class="vessel-step-title">${Parser.parseInline(Lexer.lexInline(title), options)}</div>${body.length ? `<div class="vessel-step-body">${Parser.parse(body, options)}</div>` : ""}</div></li>`
    })
    .join("")
  return `<ol class="vessel-steps vessel-steps--${mode}" aria-label="${mode === "steps" ? "步骤条" : "时间线"}">${rows}</ol>`
}
