import { emptyLineAfterHeading } from "./empty-line-insertion"
import { scheduleInsertFocus } from "./insert-focus"
import type Vditor from "vditor"
import { isEmptyParagraph } from "./image-paragraph"

/** Inserts two empty columns and two rows, then focuses the first cell. */
export function insertEmptyTable(editor: Vditor, editable: HTMLElement) {
  const selection = window.getSelection()
  const caret = selection?.rangeCount ? selection.getRangeAt(0) : null
  const element = caret?.startContainer instanceof Element ? caret.startContainer : caret?.startContainer.parentElement
  const paragraph = element?.closest("p")
  const placeholder = caret?.collapsed && paragraph?.parentElement === editable && isEmptyParagraph(paragraph) ? paragraph : null
  const cleanEmptyLine = emptyLineAfterHeading(editable)
  const existing = new Set(editable.querySelectorAll("table"))
  editor.insertMD("| | |\n| --- | --- |\n| | |\n")
  const table = Array.from(editable.querySelectorAll("table")).find((node) => !existing.has(node))
  if (!table) return
  if (placeholder?.isConnected && isEmptyParagraph(placeholder) && placeholder.nextElementSibling === table) placeholder.remove()
  if (cleanEmptyLine?.()) editable.dispatchEvent(new InputEvent("input", { bubbles: true }))
  const index = Array.from(editable.querySelectorAll("table")).indexOf(table)
  const focus = () => {
    if (!editable.isConnected) return
    const currentTable = table.isConnected ? table : editable.querySelectorAll("table")[index]
    const cell = currentTable?.rows[0]?.cells[0]
    if (!cell) return
    editable.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(cell)
    range.collapse(true)
    const current = window.getSelection()
    current?.removeAllRanges()
    current?.addRange(range)
  }
  focus()
  scheduleInsertFocus(editable, focus)
}
