import { badgeVariants } from "@/components/ui/badge"

/** 给即时编辑正文中的标签添加 Badge 样式；只包装文本，保留 Markdown 原始字符。 */
export function decorateMarkdownTags(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!node.parentElement?.closest("pre,code,a,h1,h2,h3,h4,h5,h6,[data-type],.vditor-ir__marker,[data-markdown-tag]")) nodes.push(node)
  }
  for (const node of nodes) {
    const pattern = /(^|\s)(#[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)/gu
    const text = node.data
    const matches = [...text.matchAll(pattern)]
    if (!matches.length) continue
    const fragment = document.createDocumentFragment()
    let offset = 0
    for (const match of matches) {
      const start = match.index! + match[1].length
      fragment.append(document.createTextNode(text.slice(offset, start)))
      const badge = document.createElement("span")
      badge.dataset.markdownTag = "true"
      badge.className = badgeVariants({ variant: "secondary" }) + " mx-0.5 text-green-700 bg-green-50"
      badge.textContent = match[2]
      fragment.append(badge)
      offset = start + match[2].length
    }
    fragment.append(document.createTextNode(text.slice(offset)))
    node.replaceWith(fragment)
  }
}
