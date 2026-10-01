import { parseWikiLinks } from "@vessel/obsidian"
/** Wrap only plain text, retaining the literal Markdown for editor round-trips. */
export function decorateWikiLinks(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!node.parentElement?.closest("pre:not(.vditor-reset),code,a,[data-wiki-target],.vditor-ir__marker")) nodes.push(node)
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
      span.dataset.wikiLabel = link.label
      span.className = "vessel-wiki-link"
      span.tabIndex = 0
      span.setAttribute("role", "link")
      span.setAttribute("aria-label", link.label)
      span.textContent = link.raw
      fragment.append(span)
      end = link.index + link.raw.length
    }
    fragment.append(node.data.slice(end))
    node.replaceWith(fragment)
  }
}

/** Contenteditable keeps focus on its root, so link editing follows selection. */
export function bindWikiLinkEditing(root: HTMLElement) {
  const update = () => {
    const selection = window.getSelection()
    root.querySelectorAll<HTMLElement>("[data-wiki-target]").forEach(link => {
      const editing = Boolean(root.contains(document.activeElement) &&
        link.closest('[contenteditable="true"]') && selection &&
        (link.contains(selection.anchorNode) || link.contains(selection.focusNode)))
      link.classList.toggle("vessel-wiki-editing", editing)
    })
  }
  const mouseDown = (event: MouseEvent) => {
    const target = event.target as Element
    const link = target.closest<HTMLElement>("[data-wiki-target]")
    if (event.button === 0 && !link && !target.closest("input,button,a")) {
      const line = target.closest<HTMLElement>("p,li")
      const editor = line?.closest<HTMLElement>('[contenteditable="true"]')
      const lastLink = Array.from(line?.querySelectorAll<HTMLElement>("[data-wiki-target]") ?? []).at(-1)
      if (editor && lastLink && root.contains(editor)) {
        const tail = document.createRange()
        tail.selectNodeContents(line!)
        tail.setStartAfter(lastLink)
        const rects = lastLink.getClientRects()
        const rect = rects[rects.length - 1]
        if (!tail.toString().trim() && rect && event.clientX >= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
          event.preventDefault()
          event.stopPropagation()
          editor.focus({ preventScroll: true })
          const range = document.createRange()
          range.setStartAfter(lastLink)
          range.collapse(true)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
          update()
          return
        }
      }
    }
    const editor = link?.closest<HTMLElement>('[contenteditable="true"]')
    if (event.button !== 0 || !link || !editor || !root.contains(link) || link.classList.contains("vessel-wiki-editing")) return
    event.preventDefault()
    editor.focus({ preventScroll: true })
    link.classList.add("vessel-wiki-editing")
    // Hit-test real source text after expansion, instead of the CSS label.
    const point = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(event.clientX, event.clientY)
    const range = point && link.contains(point.startContainer) ? point : document.createRange()
    if (range !== point) { range.selectNodeContents(link); range.collapse(false) }
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    update()
  }
  root.addEventListener("mousedown", mouseDown, true)
  root.addEventListener("focusout", update)
  document.addEventListener("selectionchange", update)
  return () => {
    root.removeEventListener("mousedown", mouseDown, true)
    root.removeEventListener("focusout", update)
    document.removeEventListener("selectionchange", update)
  }
}
