import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Plus, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2 } from "lucide-react"

type TableActionType = 'row-above' | 'row-below' | 'col-left' | 'col-right' | 'del-row' | 'del-col'

function triggerTableAction(cell: HTMLTableCellElement, action: TableActionType) {
  const table = cell.closest('table')
  const editor = table?.closest<HTMLElement>('[contenteditable="true"]')
  if (!cell || !editor || !table) return
  editor.focus({ preventScroll: true })
  const range = document.createRange()
  range.selectNodeContents(cell)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)

  const mac = /Mac/.test(navigator.platform)
  let key = '='
  let code = 'Equal'
  let keyCode = 187
  let shiftKey = false

  if (action === 'row-above') { key = 'F'; code = 'KeyF'; keyCode = 70; shiftKey = true }
  else if (action === 'row-below') { key = '='; code = 'Equal'; keyCode = 187; shiftKey = false }
  else if (action === 'col-left') { key = 'G'; code = 'KeyG'; keyCode = 71; shiftKey = true }
  else if (action === 'col-right') { key = '='; code = 'Equal'; keyCode = 187; shiftKey = true }
  else if (action === 'del-row') { key = '-'; code = 'Minus'; keyCode = 189; shiftKey = false }
  else if (action === 'del-col') { key = '-'; code = 'Minus'; keyCode = 189; shiftKey = true }

  const evt = new KeyboardEvent('keydown', {
    key, code, keyCode, which: keyCode, metaKey: mac, ctrlKey: !mac, shiftKey, bubbles: true, cancelable: true
  })
  const handled = !editor.dispatchEvent(evt)

  if (!handled) {
    if (action === 'row-above') {
      const tr = cell.closest('tr')
      if (tr) {
        const colCount = tr.children.length
        const isHeader = cell.tagName === 'TH'
        const newTr = document.createElement('tr')
        for (let i = 0; i < colCount; i++) {
          const tag = isHeader ? 'th' : 'td'
          const c = document.createElement(tag)
          c.textContent = ' '
          newTr.appendChild(c)
        }
        tr.parentElement?.insertBefore(newTr, tr)
      }
    } else if (action === 'row-below') {
      const tr = cell.closest('tr')
      if (tr) {
        const colCount = tr.children.length
        const newTr = document.createElement('tr')
        for (let i = 0; i < colCount; i++) {
          const c = document.createElement('td')
          c.textContent = ' '
          newTr.appendChild(c)
        }
        if (tr.nextElementSibling) {
          tr.parentElement?.insertBefore(newTr, tr.nextElementSibling)
        } else {
          tr.parentElement?.appendChild(newTr)
        }
      }
    } else if (action === 'col-left' || action === 'col-right') {
      const colIndex = cell.cellIndex
      for (let r = 0; r < table.rows.length; r++) {
        const rowElem = table.rows[r]
        const tag = r === 0 ? 'th' : 'td'
        const c = document.createElement(tag)
        c.textContent = ' '
        const refCell = rowElem.cells[colIndex]
        if (action === 'col-left') {
          rowElem.insertBefore(c, refCell)
        } else {
          if (refCell?.nextElementSibling) {
            rowElem.insertBefore(c, refCell.nextElementSibling)
          } else {
            rowElem.appendChild(c)
          }
        }
      }
    } else if (action === 'del-row') {
      const tr = cell.closest('tr')
      if (tr && table.rows.length > 1) tr.remove()
    } else if (action === 'del-col') {
      const colIndex = cell.cellIndex
      if (table.rows[0]?.cells.length > 1) {
        for (let r = 0; r < table.rows.length; r++) {
          table.rows[r].cells[colIndex]?.remove()
        }
      }
    }
    editor.dispatchEvent(new InputEvent('input', { bubbles: true }))
  }
}

/** Floating controls stay outside editable Markdown so they never enter saved content. */
export function bindTableActions(root: HTMLElement) {
  let table: HTMLTableElement | null = null
  let activeMenuCell: HTMLTableCellElement | null = null
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
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: '=', code: 'Equal', keyCode: 187, which: 187, metaKey: mac, ctrlKey: !mac, shiftKey: button === column, bubbles: true, cancelable: true }))
      hide()
    }
  }

  // 右键菜单
  const menu = document.createElement('div')
  menu.className = 'vessel-table-menu'
  menu.hidden = true
  document.body.appendChild(menu)

  const menuItems: ({ id: TableActionType; label: string; icon: typeof Plus; danger?: boolean } | { id: 'divider' })[] = [
    { id: 'row-above', label: '在上方插入一行', icon: ArrowUp },
    { id: 'row-below', label: '在下方插入一行', icon: ArrowDown },
    { id: 'col-left', label: '在左边插入一列', icon: ArrowLeft },
    { id: 'col-right', label: '在右边插入一列', icon: ArrowRight },
    { id: 'divider' },
    { id: 'del-row', label: '删除当前行', icon: Trash2, danger: true },
    { id: 'del-col', label: '删除当前列', icon: Trash2, danger: true }
  ]

  menuItems.forEach(item => {
    if (item.id === 'divider') {
      menu.appendChild(document.createElement('hr'))
      return
    }
    const btn = document.createElement('button')
    btn.type = 'button'
    if (item.danger) btn.className = 'danger'
    btn.innerHTML = `${renderToStaticMarkup(createElement(item.icon, { size: 14 }))}<span>${item.label}</span>`
    btn.onmousedown = e => { e.preventDefault(); e.stopPropagation() }
    btn.onclick = e => {
      e.preventDefault(); e.stopPropagation()
      if (activeMenuCell) triggerTableAction(activeMenuCell, item.id)
      hideMenu()
    }
    menu.appendChild(btn)
  })

  function hideMenu() {
    menu.hidden = true
    activeMenuCell = null
  }

  function hide() { row.hidden = true; column.hidden = true }

  const onContextMenu = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const cell = target.closest<HTMLTableCellElement>('td, th')
    const t = cell?.closest('table')
    if (!cell || !t || !root.contains(t)) {
      hideMenu()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    activeMenuCell = cell
    menu.hidden = false
    const menuWidth = 160
    const menuHeight = 220
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8)
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8)
    menu.style.left = `${x}px`
    menu.style.top = `${y}px`
  }

  const onPointerDown = (event: PointerEvent) => {
    if (!menu.contains(event.target as Node)) {
      hideMenu()
    }
  }

  const move = (event: PointerEvent) => {
    if (row.contains(event.target as Node) || column.contains(event.target as Node) || menu.contains(event.target as Node)) return
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

  document.addEventListener('contextmenu', onContextMenu, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointermove', move)
  window.addEventListener('scroll', hide, true)
  window.addEventListener('scroll', hideMenu, true)
  return () => {
    document.removeEventListener('contextmenu', onContextMenu, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('pointermove', move)
    window.removeEventListener('scroll', hide, true)
    window.removeEventListener('scroll', hideMenu, true)
    row.remove(); column.remove(); menu.remove()
  }
}

function cellBounds(table: HTMLTableElement) {
  const cells = Array.from(table.querySelectorAll("th, td")).filter(cell => cell.closest("table") === table).map(cell => cell.getBoundingClientRect())
  if (!cells.length) return table.getBoundingClientRect()
  return { left: Math.min(...cells.map(r => r.left)), right: Math.max(...cells.map(r => r.right)), top: Math.min(...cells.map(r => r.top)), bottom: Math.max(...cells.map(r => r.bottom)) }
}
