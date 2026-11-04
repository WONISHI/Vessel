import { documentSession } from "./document-session"

const ignored = '.vditor-ir__preview, [contenteditable="false"]'
function textNodes(root: HTMLElement) {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) if (!walker.currentNode.parentElement?.closest(ignored)) nodes.push(walker.currentNode as Text)
  return nodes
}

/** Remember source offsets, not live Ranges that retain the entire detached editor tree. */
export function bindMarkdownView(host: HTMLElement, path: string) {
  const saved = documentSession(path).markdown
  let latest = saved ? { ...saved } : { top: 0, left: 0 }
  const content = () => host.querySelector<HTMLElement>('.vditor-ir .vditor-reset')
  const remember = () => {
    const root = content()
    if (!root || !root.getClientRects().length) return
    latest = { ...latest, top: root.scrollTop, left: root.scrollLeft }
    const selection = window.getSelection()
    if (selection?.anchorNode && selection.focusNode && root.contains(selection.anchorNode) && root.contains(selection.focusNode)) {
      const offset = (node: Node, end: number) => {
        const range = document.createRange(); range.selectNodeContents(root); range.setEnd(node, end)
        let length = 0
        for (const text of textNodes(root)) {
          if (text === node) return length + end
          if (range.comparePoint(text, text.length) > 0) break
          length += text.length
        }
        return length
      }
      latest = { ...latest, anchor: offset(selection.anchorNode, selection.anchorOffset), focus: offset(selection.focusNode, selection.focusOffset) }
    }
    documentSession(path).markdown = latest
  }
  host.addEventListener('scroll', remember, true)
  document.addEventListener('selectionchange', remember)
  return {
    restore() {
      const root = content()
      if (!saved || !root) return
      if (saved.anchor !== undefined && saved.focus !== undefined && root.getClientRects().length && !host.closest('[inert]')) {
        const nodes = textNodes(root)
        const point = (offset: number): [Node, number] => {
          for (const node of nodes) { if (offset <= node.length) return [node, offset]; offset -= node.length }
          return [root, root.childNodes.length]
        }
        root.focus({ preventScroll: true })
        window.getSelection()?.setBaseAndExtent(...point(saved.anchor), ...point(saved.focus))
      }
      root.scrollTop = saved.top; root.scrollLeft = saved.left
    },
    dispose() { remember(); host.removeEventListener('scroll', remember, true); document.removeEventListener('selectionchange', remember) }
  }
}
