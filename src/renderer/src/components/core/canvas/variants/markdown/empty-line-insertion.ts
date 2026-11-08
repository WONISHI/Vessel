import { isEmptyParagraph } from "./image-paragraph"

/** Tracks only an empty insertion line directly below a heading. */
export function emptyLineAfterHeading(editable: HTMLElement) {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !selection.isCollapsed) return undefined
  const range = selection.getRangeAt(0)
  const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
  const paragraph = element?.closest("p")
  const heading = paragraph?.previousElementSibling
  if (!paragraph || paragraph.parentElement !== editable || !isEmptyParagraph(paragraph) || !heading?.matches("h1,h2,h3,h4,h5,h6")) return undefined
  const index = Array.from(editable.children).indexOf(heading)
  const oldNext = paragraph.nextElementSibling
  const title = heading.textContent
  return () => {
    const current = editable.children[index]
    if (!current?.matches(heading.tagName) || current.textContent !== title) return false
    const empty = current.nextElementSibling
    if (!isEmptyParagraph(empty) || !empty.nextElementSibling || empty.nextElementSibling === oldNext) return false
    empty.remove()
    return true
  }
}

/** Removes only an existing empty insertion paragraph left before newly pasted blocks. */
export function bindEmptyLinePaste(root: HTMLElement) {
  let stop: (() => void) | undefined
  const paste = (event: ClipboardEvent) => {
    stop?.()
    const text = event.clipboardData?.getData("text/plain") ?? ""
    // Leading blank lines explicitly copied by the user are meaningful.
    if (!text.trim() || /^\s*\r?\n/.test(text) || event.clipboardData?.files.length) return
    const editable = root.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
    const selection = window.getSelection()
    if (!editable || !selection?.isCollapsed || !selection.rangeCount) return
    const start = selection.getRangeAt(0).startContainer
    const element = start instanceof Element ? start : start.parentElement
    const paragraph = element?.closest("p")
    if (!paragraph || paragraph.parentElement !== editable || !isEmptyParagraph(paragraph)) return
    const index = Array.from(editable.children).indexOf(paragraph)
    const before = Array.from(editable.children).slice(0, index).map((node) => node.textContent).join("\n")
    const tail = Array.from(editable.children).slice(index + 1).map((node) => node.textContent).join("\n")
    const oldCount = editable.children.length
    let timer: ReturnType<typeof setTimeout>
    const observer = new MutationObserver(() => {
      const nodes = Array.from(editable.children)
      if (nodes.length <= oldCount || nodes.slice(0, index).map((node) => node.textContent).join("\n") !== before) return
      const empty = nodes[index]
      const inserted = nodes[index + 1]
      if (!isEmptyParagraph(empty) || !inserted || isEmptyParagraph(inserted)) return
      // Verify that a new block appeared before the unchanged original trailing content.
      const trailingCount = oldCount - index - 1
      if (trailingCount && nodes.slice(-trailingCount).map((node) => node.textContent).join("\n") !== tail) return
      stop?.()
      empty.remove()
      editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }))
    })
    stop = () => { observer.disconnect(); clearTimeout(timer); stop = undefined }
    observer.observe(editable, { childList: true, subtree: true, characterData: true })
    timer = setTimeout(() => stop?.(), 1000)
  }
  root.addEventListener("paste", paste, true)
  return () => { stop?.(); root.removeEventListener("paste", paste, true) }
}
