import type Vditor from "vditor"
import { isEmptyParagraph } from "./image-paragraph"
import { decorateCodeBlocks } from "./code-blocks"

/** Insert an empty block and place the caret in its editable code, rather than after the fence. */
export function insertEmptyCodeBlock(editor: Vditor, editable: HTMLElement) {
  const selectionBefore = window.getSelection()
  const caret = selectionBefore?.rangeCount ? selectionBefore.getRangeAt(0) : null
  const element = caret?.startContainer instanceof Element ? caret.startContainer : caret?.startContainer.parentElement
  const paragraph = element?.closest("p")
  const placeholder = caret?.collapsed && paragraph && editable.contains(paragraph) && isEmptyParagraph(paragraph) ? paragraph : null
  const existing = new Set(editable.querySelectorAll('[data-type="code-block"]'))
  editor.insertMD("```text\n\n```\n")
  const block = Array.from(editable.querySelectorAll<HTMLElement>('[data-type="code-block"]')).find((item) => {
    const code = item.querySelector("pre.vditor-ir__marker code")
    return !existing.has(item) && code && !code.textContent?.replace(/\u200b/g, "").trim()
  })
  if (!block) return
  if (placeholder?.isConnected && isEmptyParagraph(placeholder) && placeholder.nextElementSibling === block) placeholder.remove()
  decorateCodeBlocks(editable)
  const code = block.querySelector("pre.vditor-ir__marker code")
  if (!code) return
  editable.focus({ preventScroll: true })
  const range = document.createRange()
  range.selectNodeContents(code)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}
