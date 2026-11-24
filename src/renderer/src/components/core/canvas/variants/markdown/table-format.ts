export type TableRectangle = { table: HTMLTableElement; top: number; bottom: number; left: number; right: number }
export type TableFormat = "bold" | "left" | "center" | "right"

/** Return one replacement table so formatting participates in the editor's native undo/input path. */
export function formatTableCells(area: TableRectangle, format: TableFormat) {
  const clone = area.table.cloneNode(true) as HTMLTableElement
  if (format !== "bold") {
    // Markdown stores alignment per column, so update every row of the selected columns.
    for (const row of Array.from(clone.rows)) for (let col = area.left; col <= area.right; col++) {
      row.cells[col]?.setAttribute("align", format)
      if (row.cells[col]) row.cells[col].style.removeProperty("text-align")
    }
    return clone
  }
  const ir = !!area.table.closest(".vditor-ir")
  const cells: HTMLTableCellElement[] = []
  for (let row = area.top; row <= area.bottom; row++) for (let col = area.left; col <= area.right; col++) {
    const cell = clone.rows[row]?.cells[col]
    if (cell) cells.push(cell)
  }
  const entirelyBold = (cell: HTMLTableCellElement) => {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) if (node.textContent?.trim() && !node.parentElement?.closest(".vditor-ir__marker, strong, b")) return false
    return !!cell.querySelector("strong,b")
  }
  const remove = cells.length > 0 && cells.every(entirelyBold)
  for (const cell of cells) {
    cell.querySelectorAll('[data-type="strong"]').forEach(node => {
      const strong = node.querySelector("strong")
      if (strong) node.replaceWith(...Array.from(strong.childNodes))
    })
    cell.querySelectorAll("strong,b").forEach(mark => mark.replaceWith(...Array.from(mark.childNodes)))
    if (!remove && cell.textContent?.trim()) {
      const strong = document.createElement("strong")
      strong.append(...Array.from(cell.childNodes))
      if (ir) {
        const node = document.createElement("span"), marker = document.createElement("span")
        node.dataset.type = "strong"
        node.className = "vditor-ir__node"
        marker.className = "vditor-ir__marker vditor-ir__marker--bi"
        marker.textContent = "**"
        strong.dataset.newline = "1"
        node.append(marker, strong, marker.cloneNode(true))
        cell.append(node)
      } else cell.append(strong)
    }
  }
  return clone
}

export function replaceEditorTable(table: HTMLTableElement, replacement: HTMLTableElement) {
  const editor = table.closest<HTMLElement>('[contenteditable="true"]')
  if (!editor || !table.isConnected) return
  table.dispatchEvent(new Event("vessel:table-replace", { bubbles: true }))
  editor.focus({ preventScroll: true })
  const range = document.createRange()
  range.selectNode(table)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.execCommand("insertHTML", false, replacement.outerHTML)
}
