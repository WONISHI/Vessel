import { parseHighlights } from "@vessel/obsidian"

/** Keep literal markers in the editor DOM so Markdown serialization remains lossless. */
export function decorateHighlights(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  const selection = window.getSelection()
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest('pre:not(.vditor-reset),code,[data-type="code-block"],.vditor-ir__marker,[data-vessel-highlight],input,textarea,button,[data-vessel-kbd]')) continue
    if (root.contains(document.activeElement) && (selection?.anchorNode === node || selection?.focusNode === node)) continue
    if (node.data.includes("==")) nodes.push(node)
  }
  for (const node of nodes) {
    const matches = parseHighlights(node.data)
    if (!matches.length) continue
    const fragment = document.createDocumentFragment()
    let offset = 0
    for (const match of matches) {
      fragment.append(node.data.slice(offset, match.start))
      const highlight = document.createElement("span")
      highlight.dataset.vesselHighlight = "true"
      for (const text of ["==", match.content, "=="]) {
        const part = document.createElement("span")
        if (text === "==") part.dataset.highlightMarker = "true"
        part.textContent = text
        highlight.append(part)
      }
      fragment.append(highlight)
      offset = match.end
    }
    fragment.append(node.data.slice(offset))
    node.replaceWith(fragment)
  }
}
