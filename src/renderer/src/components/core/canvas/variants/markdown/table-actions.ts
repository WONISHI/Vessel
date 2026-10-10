import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Plus } from "lucide-react"
/** Floating controls stay outside editable Markdown so they never enter saved content. */
export function bindTableActions(root: HTMLElement) {
  let table: HTMLTableElement | null = null
  const row = document.createElement('button'), column = document.createElement('button')
  for (const [button, label] of [[row, '在下方新增行'], [column, '在右侧新增列']] as const) {
    button.type = 'button'; button.className = 'vessel-table-add'; button.innerHTML = renderToStaticMarkup(createElement(Plus, { size: 14, "aria-hidden": true }))
    button.setAttribute('aria-label', label); button.title = label; button.hidden = true
    document.body.appendChild(button)
    button.onmousedown = event => { event.preventDefault(); event.stopPropagation() }
    button.onclick = event => {
      event.preventDefault(); event.stopPropagation()
      if (!table?.isConnected) return
      const cells = button === row ? table.rows[table.rows.length - 1]?.cells : table.rows[0]?.cells
      const cell = cells?.[cells.length - 1]
      const editor = table.closest<HTMLElement>('[contenteditable="true"]')
      if (!cell || !editor) return
      editor.focus({ preventScroll: true })
      const range = document.createRange(); range.selectNodeContents(cell); range.collapse(false)
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
      const mac = /Mac/.test(navigator.platform)
      // Use Vditor's own table command so undo, Markdown serialization and saving stay in sync.
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: '=', code: 'Equal', keyCode: 187, which: 187, metaKey: mac, ctrlKey: !mac, shiftKey: button === column, bubbles: true, cancelable: true }))
      hide()
    }
  }
  function hide() { row.hidden = true; column.hidden = true }
  const move = (event: PointerEvent) => {
    if (row.contains(event.target as Node) || column.contains(event.target as Node)) return
    if (!root.getClientRects().length) { hide(); return }
    const viewport = root.closest('[data-radix-scroll-area-viewport]')?.getBoundingClientRect()
    if (viewport && (event.clientY < viewport.top || event.clientY > viewport.bottom)) { hide(); return }
    const candidate = Array.from(root.querySelectorAll<HTMLTableElement>('.vditor-ir table, .vditor-wysiwyg table')).find(element => {
      const bounds = cellBounds(element)
      return event.clientX >= bounds.left - 5 && event.clientX <= bounds.right + 26 && event.clientY >= bounds.top - 5 && event.clientY <= bounds.bottom + 26
    })
    if (!candidate) { hide(); return }
    table = candidate
    const bounds = cellBounds(table)
    row.hidden = event.clientY < bounds.bottom - 10
    column.hidden = event.clientX < Math.min(bounds.right, root.getBoundingClientRect().right, innerWidth) - 24
    const hoveredCell = Array.from(table.rows[table.rows.length - 1]?.cells || []).find(cell => { const r = cell.getBoundingClientRect(); return event.clientX >= r.left && event.clientX <= r.right })
    const hoveredBounds = hoveredCell?.getBoundingClientRect() || bounds
    const hoveredRow = Array.from(table.rows).find(row => { const r = row.getBoundingClientRect(); return event.clientY >= r.top && event.clientY <= r.bottom })
    const rowBounds = hoveredRow?.getBoundingClientRect() || bounds
    row.style.left = `${(hoveredBounds.left + hoveredBounds.right) / 2 - 10}px`
    row.style.top = `${bounds.bottom + 3}px`
    column.style.left = `${Math.min(innerWidth - 24, root.getBoundingClientRect().right - 22, bounds.right + 3)}px`
    column.style.top = `${(rowBounds.top + rowBounds.bottom) / 2 - 10}px`
  }
  document.addEventListener('pointermove', move)
  window.addEventListener('scroll', hide, true)
  return () => { document.removeEventListener('pointermove', move); window.removeEventListener('scroll', hide, true); row.remove(); column.remove() }
}

function cellBounds(table: HTMLTableElement) {
  const cells = Array.from(table.querySelectorAll("th, td")).filter(cell => cell.closest("table") === table).map(cell => cell.getBoundingClientRect())
  if (!cells.length) return table.getBoundingClientRect()
  return { left: Math.min(...cells.map(r => r.left)), right: Math.max(...cells.map(r => r.right)), top: Math.min(...cells.map(r => r.top)), bottom: Math.max(...cells.map(r => r.bottom)) }
}
