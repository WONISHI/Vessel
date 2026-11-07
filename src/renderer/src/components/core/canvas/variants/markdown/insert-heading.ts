import { scheduleInsertFocus } from "./insert-focus"
import type Vditor from "vditor"
import { isEmptyParagraph } from "./image-paragraph"

/** Inserts an editable heading and keeps the caret inside its empty text. */
export function insertEmptyHeading(editor: Vditor, editable: HTMLElement, level: number) {
  insertEmptyMarkdownBlock(editor, editable, "#".repeat(level), `h${level}`)
}

/** Keeps newly inserted block content empty and restores its caret after the menu closes. */
export function insertEmptyMarkdownBlock(editor: Vditor, editable: HTMLElement, prefix: string, selector: string, inline = false, options: { content?: string; suffix?: string } = {}) {
  const selection = window.getSelection()
  const caret = selection?.rangeCount ? selection.getRangeAt(0) : null
  const element = caret?.startContainer instanceof Element ? caret.startContainer : caret?.startContainer.parentElement
  const paragraph = element?.closest("p")
  const placeholder = caret?.collapsed && paragraph?.parentElement === editable && isEmptyParagraph(paragraph) ? paragraph : null
  const marker = `vessel-block-${crypto.randomUUID()}`
  editor.insertMD(inline ? `${prefix}${marker}${prefix}` : `${prefix} ${marker}\n${options.suffix ?? ""}`)
  const heading = Array.from(editable.querySelectorAll<HTMLElement>(selector)).find((node) => node.textContent?.includes(marker))
  if (!heading) return
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
  let text: Text | undefined
  let contentOffset = 0
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.data.includes(marker)) {
      contentOffset = node.data.indexOf(marker)
      node.data = node.data.replace(marker, options.content ?? "\u200b")
      text = node
      break
    }
  }
  if (!inline && placeholder?.isConnected && isEmptyParagraph(placeholder) && placeholder.nextElementSibling === (heading.closest("blockquote") ?? heading)) placeholder.remove()
  const headingIndex = Array.from(editable.querySelectorAll(selector)).indexOf(heading)
  const focus = () => {
    if (!editable.isConnected) return
    const target = heading.isConnected ? heading : editable.querySelectorAll(selector)[headingIndex]
    if (!target) return
    editable.focus({ preventScroll: true })
    const range = document.createRange()
    if (text?.isConnected) range.setStart(text, Math.min(contentOffset, text.length))
    else { range.selectNodeContents(target); range.collapse(false) }
    range.collapse(true)
    const current = window.getSelection()
    current?.removeAllRanges()
    current?.addRange(range)
  }
  focus()
  editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }))
  // Radix restores menu focus after selection, so restore the heading caret after teardown.
  scheduleInsertFocus(editable, focus)
}
