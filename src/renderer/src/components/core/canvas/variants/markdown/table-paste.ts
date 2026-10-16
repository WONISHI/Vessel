/** Escapes escape. */
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Performs the cell text operation. */
const cellText = (cell: Element) => {
  const clone = cell.cloneNode(true) as Element
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"))
  return clone.textContent || ""
}
/** Read a rectangular clipboard without dropping empty leading/trailing cells. */
export function clipboardCells(text: string, html = ""): string[][] | null {
  if (html) {
    const table = new DOMParser().parseFromString(html, "text/html").querySelector("table")
    if (table) return Array.from(table.rows, (row) => Array.from(row.cells, cellText))
  }
  const lines = text.replace(/\r\n?/g, "\n").trimEnd().split("\n")

  /** Splits split. */
  const split = (line: string) => {
    const value = line
      .trim()
      .replace(/^\|/, "")
      .replace(/(?<!\\)\|$/, "")
    return value.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"))
  }
  if (lines.length > 1 && lines[1].includes("|") && split(lines[1]).every((cell) => /^:?-{3,}:?$/.test(cell))) {
    return lines.filter((_, index) => index !== 1).map(split)
  }
  if (!text.includes("\t")) return null
  // TSV quoted fields support newlines and tabs copied from spreadsheets.
  const rows: string[][] = [[]]
  let value = "",
    quoted = false
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n$/, "")
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (ch === '"' && (quoted || !value)) {
      if (quoted && normalized[i + 1] === '"') {
        value += '"'
        i++
      } else quoted = !quoted
    } else if (!quoted && (ch === "\t" || ch === "\n")) {
      rows.at(-1)!.push(value)
      value = ""
      if (ch === "\n") rows.push([])
    } else value += ch
  }
  rows.at(-1)!.push(value)
  return rows
}

/** Performs the fill table operation. */
export function fillTable(table: HTMLTableElement, row: number, column: number, values: string[][]) {
  const clone = table.cloneNode(true) as HTMLTableElement
  const width = Math.max(...Array.from(clone.rows, (r) => r.cells.length), column + Math.max(...values.map((r) => r.length)))
  while (clone.rows.length < row + values.length) clone.insertRow()
  for (const r of Array.from(clone.rows))
    while (r.cells.length < width) {
      r.appendChild(document.createElement(r.parentElement?.tagName === "THEAD" ? "th" : "td"))
    }
  values.forEach((cells, y) =>
    cells.forEach((value, x) => {
      clone.rows[row + y].cells[column + x].innerHTML = escape(value).replace(/\n/g, "<br>") || "<br>"
    })
  )
  return clone
}

/** Drag across cells (or Shift-click) to select a rectangle; single-cell editing stays native. */
export function bindTablePaste(root: HTMLElement) {
  type Cell = HTMLTableCellElement
  let anchor: Cell | null = null,
    end: Cell | null = null,
    dragging = false
  const overlays: HTMLElement[] = []

  /** Performs the cell at operation. */
  const cellAt = (node: EventTarget | Node | null) => {
    const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null
    const cell = element?.closest<Cell>("td,th")
    return cell && root.contains(cell) ? cell : null
  }

  /** Clears clear. */
  const clear = () => {
    overlays.splice(0).forEach((element) => element.remove())
    end = null
  }

  /** Performs the bounds operation. */
  const bounds = () => {
    if (!anchor || !end || anchor.closest("table") !== end.closest("table")) return null
    const a = (anchor.parentElement as HTMLTableRowElement).rowIndex
    const b = (end.parentElement as HTMLTableRowElement).rowIndex
    return { table: anchor.closest("table")!, top: Math.min(a, b), bottom: Math.max(a, b), left: Math.min(anchor.cellIndex, end.cellIndex), right: Math.max(anchor.cellIndex, end.cellIndex) }
  }

  /** Performs the paint operation. */
  const paint = () => {
    overlays.splice(0).forEach((element) => element.remove())
    const area = bounds()
    if (!area) return
    for (let y = area.top; y <= area.bottom; y++)
      for (let x = area.left; x <= area.right; x++) {
        const cell = area.table.rows[y]?.cells[x]
        if (!cell) continue
        const rect = cell.getBoundingClientRect(),
          overlay = document.createElement("div")
        overlay.className = "vessel-table-cell-selection"
        Object.assign(overlay.style, { position: "fixed", pointerEvents: "none", zIndex: "9", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, background: "rgba(37,99,235,.12)", border: "1px solid rgba(37,99,235,.4)" })
        document.body.append(overlay)
        overlays.push(overlay)
      }
  }

  /** Performs the down operation. */
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return
    const cell = cellAt(event.target)
    if (event.shiftKey && cell && anchor && cell.closest("table") === anchor.closest("table")) {
      event.preventDefault()
      end = cell
      paint()
      return
    }
    clear()
    anchor = cell
    dragging = !!cell
  }

  /** Moves move. */
  const move = (event: PointerEvent) => {
    const cell = cellAt(event.target)
    if (!dragging || !anchor || !cell || cell.closest("table") !== anchor.closest("table") || (cell === anchor && !end)) return
    event.preventDefault()
    end = cell
    const range = document.createRange()
    range.selectNodeContents(anchor)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    paint()
  }

  /** Performs the up operation. */
  const up = () => {
    dragging = false
  }

  /** Performs the click operation. */
  const click = (event: MouseEvent) => {
    if (end) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  /** Copies copy. */
  const copy = (event: ClipboardEvent) => {
    const area = bounds()
    if (!area || !event.clipboardData) return
    const values = Array.from({ length: area.bottom - area.top + 1 }, (_, y) =>
      Array.from({ length: area.right - area.left + 1 }, (_, x) => {
        const cell = area.table.rows[area.top + y]?.cells[area.left + x]
        return cell ? cellText(cell) : ""
      })
    )
    event.preventDefault()
    event.stopImmediatePropagation()
    event.clipboardData.setData("text/plain", values.map((row) => row.map((value) => (/[\t\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)).join("\t")).join("\n"))
    event.clipboardData.setData("text/html", `<table>${values.map((row) => `<tr>${row.map((value) => `<td>${escape(value).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("")}</table>`)
  }

  /** Pastes paste. */
  const paste = (event: ClipboardEvent) => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !event.clipboardData || event.clipboardData.files.length) return
    const area = bounds()
    const cell = area ? area.table.rows[area.top].cells[area.left] : cellAt(selection.anchorNode)
    if (!cell || (!area && !cell.contains(selection.focusNode))) return
    const text = event.clipboardData.getData("text/plain")
    const values = clipboardCells(text, event.clipboardData.getData("text/html"))
    if (!text && !values) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (values?.length && values.some((row) => row.length)) {
      const table = cell.closest("table")!
      const replacement = fillTable(table, (cell.parentElement as HTMLTableRowElement).rowIndex, cell.cellIndex, values)
      clear()
      anchor = null
      const range = document.createRange()
      range.selectNode(table)
      selection.removeAllRanges()
      selection.addRange(range)
      // One native edit lets Vditor process input, saving and undo as a single change.
      document.execCommand("insertHTML", false, replacement.outerHTML)
    } else document.execCommand("insertHTML", false, text.replace(/\r\n?/g, "\n").split("\n").map(escape).join("<br>"))
  }

  /** Performs the key operation. */
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      clear()
      anchor = null
    }
  }
  root.addEventListener("click", click, true)
  root.addEventListener("paste", paste, true)
  root.addEventListener("copy", copy, true)
  document.addEventListener("pointerdown", down, true)
  document.addEventListener("pointermove", move, true)
  document.addEventListener("pointerup", up)
  document.addEventListener("pointercancel", up)
  root.addEventListener("keydown", key)
  window.addEventListener("scroll", clear, true)
  window.addEventListener("resize", clear)
  return () => {
    clear()
    root.removeEventListener("click", click, true)
    root.removeEventListener("paste", paste, true)
    root.removeEventListener("copy", copy, true)
    document.removeEventListener("pointerdown", down, true)
    document.removeEventListener("pointermove", move, true)
    document.removeEventListener("pointerup", up)
    document.removeEventListener("pointercancel", up)
    root.removeEventListener("keydown", key)
    window.removeEventListener("scroll", clear, true)
    window.removeEventListener("resize", clear)
  }
}
