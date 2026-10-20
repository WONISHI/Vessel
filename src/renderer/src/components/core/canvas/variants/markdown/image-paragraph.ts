/** Focuses the editable line next to an image, creating it only when necessary. */
export function focusImageParagraph(block: HTMLElement, below = true): HTMLElement | null {
  const editor = block.closest<HTMLElement>('[contenteditable="true"]')
  if (!editor) return null
  const adjacent = below ? block.nextElementSibling : block.previousElementSibling
  const paragraph = adjacent instanceof HTMLElement && adjacent.tagName === "P" && !adjacent.querySelector('[contenteditable="false"], img')
    ? adjacent : insertImageParagraph(block, below)
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
  editor.focus({ preventScroll: true })
  const selection = window.getSelection()
  if (!selection) return null
  const range = document.createRange()
  if (below) range.setStartAfter(block)
  else range.setStartBefore(block)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  // Native insertion gives the paragraph its own undo step and normal editor input events.
  document.execCommand("insertHTML", false, '<p data-block="0"><br></p>')
  const paragraph = (below ? block.nextElementSibling : block.previousElementSibling) as HTMLElement | null
  if (paragraph?.tagName !== "P") return null
  const caret = document.createRange()
  caret.selectNodeContents(paragraph)
  caret.collapse(true)
  selection.removeAllRanges()
  selection.addRange(caret)
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
