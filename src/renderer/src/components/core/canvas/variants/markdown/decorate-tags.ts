import { parseMarkdownTags } from "@vessel/obsidian"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Badge } from "@/components/ui/badge"

/** 给即时编辑正文中的标签添加 Badge 样式；只包装文本，保留 Markdown 原始字符。 */
export function decorateMarkdownTags(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!node.parentElement?.closest('pre:not(.vditor-reset),code,a,h1,h2,h3,h4,h5,h6,[data-type="code-block"],.vditor-ir__marker,[data-markdown-tag]')) nodes.push(node)
  }
  for (const node of nodes) {
    const text = node.data
    const matches = parseMarkdownTags(text)
    if (!matches.length) continue
    const fragment = document.createDocumentFragment()
    let offset = 0
    for (const match of matches) {
      const start = match.start
      fragment.append(document.createTextNode(text.slice(offset, start)))
      const template = document.createElement("template")
      template.innerHTML = renderToStaticMarkup(createElement(Badge, { asChild: true, variant: "secondary", className: "mx-0.5 text-green-700 bg-green-50" }, createElement("span", { "data-markdown-tag": "true" }, match.raw)))
      const badge = template.content.firstChild!
      fragment.append(badge)
      offset = match.end
    }
    fragment.append(document.createTextNode(text.slice(offset)))
    node.replaceWith(fragment)
  }
}
