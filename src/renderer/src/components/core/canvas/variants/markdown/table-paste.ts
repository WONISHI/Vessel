/** Rich clipboard code must remain text inside the selected table cell. */
export function bindTablePaste(root: HTMLElement) {
  const paste = (event: ClipboardEvent) => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !event.clipboardData) return
    const node = selection.anchorNode
    const cell = (node instanceof Element ? node : node?.parentElement)?.closest('td,th')
    const end = selection.focusNode
    if (!cell || !root.contains(cell) || !cell.contains(end)) return
    const text = event.clipboardData.getData('text/plain')
    if (!text || event.clipboardData.files.length) return
    event.preventDefault(); event.stopImmediatePropagation()
    // A newline in a Markdown table must be an inline break, not a new block/fence.
    const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    document.execCommand('insertHTML', false, text.replace(/\r\n?/g, '\n').split('\n').map(escape).join('<br>'))
  }
  root.addEventListener('paste', paste, true)
  return () => root.removeEventListener('paste', paste, true)
}
