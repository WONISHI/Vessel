import type Vditor from "vditor"

/** Use Vditor's local language completion instead of reparsing the document with setValue. */
export function changeCodeLanguage(editor: Vditor, block: HTMLElement, language: string): boolean {
  const info = block.querySelector<HTMLElement>('[data-type="code-block-info"]')
  const source = block.querySelector<HTMLElement>("pre.vditor-ir__marker code")
  if (!block.isConnected || !info || !source) return false
  const current = source.className.match(/language-([^\s]+)/)?.[1] || "text"
  if (current === language) return false
  const selection = window.getSelection()
  if (!selection) return false
  const savedRange = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null
  const scrollPositions: { element: HTMLElement; top: number; left: number }[] = []
  for (let element: HTMLElement | null = block.parentElement; element; element = element.parentElement) {
    scrollPositions.push({ element, top: element.scrollTop, left: element.scrollLeft })
  }
  editor.vditor.undo?.addToUndoStack(editor.vditor)
  // Rebuild only this preview's raw code; the native renderer then applies the new language.
  const preview = block.querySelector<HTMLElement>(".vditor-ir__preview")
  if (preview) {
    const code = document.createElement("code")
    code.className = source.className
    code.textContent = source.textContent
    preview.replaceChildren(code)
  }
  const range = document.createRange()
  range.selectNodeContents(info)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  const option = document.createElement("button")
  option.dataset.value = encodeURIComponent(language)
  try {
    // Native completion updates both code nodes, renders this preview, then emits input and records undo.
    editor.vditor.hint.fillEmoji(option, editor.vditor)
  } finally {
    selection.removeAllRanges()
    if (savedRange?.startContainer.isConnected && savedRange.endContainer.isConnected) selection.addRange(savedRange)
    for (const { element, top, left } of scrollPositions) {
      element.scrollTop = top
      element.scrollLeft = left
    }
  }
  return true
}
