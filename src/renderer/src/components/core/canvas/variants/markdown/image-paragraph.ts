/** Checks if an element is an empty paragraph (contains no text or only whitespace / zero-width space, and no sub-blocks/images). */
export function isEmptyParagraph(node: Node | null | undefined): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false
  if (node.tagName !== "P") return false
  if (node.querySelector('[contenteditable="false"], img, table, pre, code')) return false
  const text = node.textContent?.replace(/[\u200B\u00A0\s]/g, "") || ""
  return text.length === 0
}

/** Focuses the editable line next to an image: directly focuses if an empty line exists, or creates a new empty line if not. */
export function focusImageParagraph(block: HTMLElement, below = true): HTMLElement | null {
  const editor = block.closest<HTMLElement>('[contenteditable="true"]')
  if (!editor) return null
  const adjacent = below ? block.nextElementSibling : block.previousElementSibling
  const paragraph = isEmptyParagraph(adjacent)
    ? adjacent
    : insertImageParagraph(block, below)
  if (!paragraph) return null
  /** Restores the caret after the context menu and editor input handlers settle. */
  const focus = () => {
    if (!paragraph.isConnected) return
    editor.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  focus()
  requestAnimationFrame(focus)
  return paragraph
}

/** Inserts an editable paragraph beside an image without splitting its encoded source block. */
export function insertImageParagraph(block: HTMLElement, below = true): HTMLElement | null {
  const editor = block.closest<HTMLElement>('[contenteditable="true"]')
  if (!editor) return null
  const paragraph = document.createElement("p")
  paragraph.setAttribute("data-block", "0")
  paragraph.innerHTML = "<br>"
  if (below) {
    block.after(paragraph)
  } else {
    block.before(paragraph)
  }
  editor.focus({ preventScroll: true })
  const selection = window.getSelection()
  if (selection) {
    const caret = document.createRange()
    caret.selectNodeContents(paragraph)
    caret.collapse(true)
    selection.removeAllRanges()
    selection.addRange(caret)
  }
  return paragraph
}

/** Handles Enter only at an image boundary; normal text and IME input stay native. */
export function bindImageParagraphs(root: HTMLElement) {
  /** Resolves the image adjoining the collapsed caret and inserts a following paragraph. */
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.isComposing || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
    const selection = window.getSelection()
    if (!selection?.isCollapsed || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
    if (!element || !root.contains(element) || element.closest('input,textarea,[contenteditable="false"]')) return
    let block = element.closest<HTMLElement>(".vessel-image-block")
    if (!block && range.startContainer instanceof Element) {
      const previous = range.startContainer.childNodes[range.startOffset - 1]
      if (previous instanceof HTMLElement && previous.classList.contains("vessel-image-block")) block = previous
    }
    // At the start of the following paragraph/quote, Enter belongs after the image.
    if (!block) {
      const editor = element.closest<HTMLElement>('[contenteditable="true"]')
      let top: HTMLElement | null = element as HTMLElement
      while (top?.parentElement && top.parentElement !== editor) top = top.parentElement
      const previous = top?.previousElementSibling
      if (editor && previous instanceof HTMLElement && previous.classList.contains("vessel-image-block")) {
        const before = range.cloneRange()
        before.setStart(top!, 0)
        if (!before.toString().trim()) block = previous
      }
    }
    if (!block) return
    event.preventDefault()
    event.stopImmediatePropagation()
    insertImageParagraph(block)
  }
  root.addEventListener("keydown", key, true)
  return () => root.removeEventListener("keydown", key, true)
}

/** Vditor inserts block Markdown after the caret paragraph; consume the empty insertion line. */
export function insertImageMarkdown(root: HTMLElement, insert: () => void) {
  const selection = window.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null
  const element = range?.startContainer instanceof Element ? range.startContainer : range?.startContainer.parentElement
  // An empty line after exiting a list can have a caret on the editor boundary,
  // rather than inside the paragraph itself.
  const boundary = range?.startContainer instanceof Element ? range.startContainer.childNodes[range.startOffset] : null
  const paragraph = element?.closest("p") || (isEmptyParagraph(boundary) ? boundary : null)
  const placeholder = range?.collapsed && paragraph && root.contains(paragraph) && isEmptyParagraph(paragraph) ? paragraph : null
  const path: number[] = []
  if (placeholder) {
    let node: Node = placeholder
    while (node !== root && node.parentNode) {
      path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes, node))
      node = node.parentNode
    }
  }
  const existingBlocks = new Set(root.querySelectorAll('[data-type="code-block"], .vessel-image-block'))
  if (placeholder && range && !placeholder.contains(range.startContainer)) {
    const caret = document.createRange()
    caret.selectNodeContents(placeholder)
    caret.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(caret)
  }
  insert()
  // Rendering may replace the editor DOM. Resolve the same insertion line again
  // rather than relying exclusively on the now-detached paragraph reference.
  const current = placeholder?.isConnected ? placeholder : placeholder ? path.reduce<Node | null>((node, index) => node?.childNodes[index] ?? null, root) : null
  const next = current instanceof Element ? current.nextElementSibling : null
  if (isEmptyParagraph(current) && next?.matches('[data-type="code-block"], .vessel-image-block') && !existingBlocks.has(next)) current.remove()
}
