import { parseWikiLinks } from "@vessel/obsidian"
/** Wrap only plain text, retaining the literal Markdown for editor round-trips. */
export function decorateWikiLinks(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!node.parentElement?.closest("pre,code,a,[data-wiki-target],.vditor-ir__marker")) nodes.push(node)
  }
  for (const node of nodes) {
    const links = parseWikiLinks(node.data)
    if (!links.length) continue
    const fragment = document.createDocumentFragment()
    let end = 0
    for (const link of links) {
      fragment.append(node.data.slice(end, link.index))
      const span = document.createElement("span")
      span.dataset.wikiTarget = link.target
      span.className = "text-green-700 underline decoration-green-300 cursor-help"
      span.textContent = link.raw
      fragment.append(span)
      end = link.index + link.raw.length
    }
    fragment.append(node.data.slice(end))
    node.replaceWith(fragment)
  }
}
