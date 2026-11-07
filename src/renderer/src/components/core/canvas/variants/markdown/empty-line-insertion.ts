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

/** Cleans a leftover paste placeholder after Vditor has processed the input. */
export function bindEmptyLinePaste(root: HTMLElement) {
  let pending: (() => boolean) | undefined
  let disposed = false
  const paste = () => {
    const editable = root.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
    pending = editable ? emptyLineAfterHeading(editable) : undefined
  }
  const input = () => {
    if (!pending) return
    const clean = pending
    pending = undefined
    queueMicrotask(() => {
      if (!disposed && clean()) {
        root.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')?.dispatchEvent(new InputEvent("input", { bubbles: true }))
      }
    })
  }
  root.addEventListener("paste", paste, true)
  root.addEventListener("input", input)
  return () => {
    disposed = true
    pending = undefined
    root.removeEventListener("paste", paste, true)
    root.removeEventListener("input", input)
  }
}
