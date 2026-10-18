export type MarkdownInsertLocation = { x: number; y: number; range: Range }

/** Saves a caret at the clicked position before the menu takes keyboard focus. */
export function bindMarkdownInsertMenu(root: HTMLElement, open: (location: MarkdownInsertLocation) => void) {
  /** Leaves table actions and embedded controls to their existing context menus. */
  const contextmenu = (event: MouseEvent) => {
    if (event.defaultPrevented || !(event.target instanceof HTMLElement)) return
    const target = event.target
    const editable = root.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
    if (!editable || !target.closest(".vditor-ir") || target.closest('table, input, textarea, button, [contenteditable="false"]')) return
    event.preventDefault()
    event.stopPropagation()
    const selection = window.getSelection()
    const current = selection?.rangeCount ? selection.getRangeAt(0) : null
    const insideSelection = current && !current.collapsed && editable.contains(current.commonAncestorContainer)
      && Array.from(current.getClientRects()).some((rect) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)
    let range = insideSelection ? current.cloneRange() : document.caretRangeFromPoint?.(event.clientX, event.clientY)
    if (!range || !editable.contains(range.commonAncestorContainer)) {
      range = document.createRange()
      range.selectNodeContents(editable)
      range.collapse(false)
    }
    open({ x: event.clientX, y: event.clientY, range: range.cloneRange() })
  }
  root.addEventListener("contextmenu", contextmenu)
  return () => root.removeEventListener("contextmenu", contextmenu)
}
