/** Converts an empty paragraph's Markdown bullet marker when its first space is typed. */
export function bindListShortcuts(root: HTMLElement) {
  /** Handles only a standalone bullet at the collapsed caret, preserving normal editing. */
  const key = (event: KeyboardEvent) => {
    if (event.key !== " " || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    const selection = window.getSelection()
    if (!selection?.isCollapsed || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
    const paragraph = element?.closest("p")
    if (!paragraph || !root.contains(paragraph) || paragraph.closest('pre,code,li,td,th,[data-type="code-block"],[contenteditable="false"]') || !paragraph.closest('[contenteditable="true"]')) return
    const prefix = range.cloneRange()
    prefix.selectNodeContents(paragraph)
    prefix.setEnd(range.startContainer, range.startOffset)
    const marker = prefix.toString()
    if (!/^[-+*]$/.test(marker) || paragraph.textContent !== marker) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const replacement = document.createRange()
    replacement.selectNode(paragraph)
    selection.removeAllRanges()
    selection.addRange(replacement)
    // A single native edit lets Vditor normalize and save the list, and supports undo.
    document.execCommand("insertHTML", false, `<ul data-block="0"><li data-marker="${marker}"><p data-block="0"><br></p></li></ul>`)
  }
  root.addEventListener("keydown", key, true)
  return () => root.removeEventListener("keydown", key, true)
}
