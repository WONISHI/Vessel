import { checkTableTask, isTableTaskList, parseTableTask, setTableTaskList } from "../tasks.js"
import { CellTextarea } from "./cell-textarea.js"
import { createPortal } from "react-dom"
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  adjustMergesOnDeleteCol,
  adjustMergesOnDeleteRow,
  adjustMergesOnInsertCol,
  adjustMergesOnInsertRow,
  getCellMergeInfo,
  mergeSelection,
  normalizeRange,
  splitMergeAt
} from "../merge-utils.js"
import { generateCellId, parseMarkdownTable } from "../parser.js"
import { serializeMarkdownTable } from "../serializer.js"
import type { MarkdownTableCell, MarkdownTableColumn, MarkdownTableData, MarkdownTableRow, TableRange } from "../types.js"
import { BG_COLORS, TEXT_COLORS } from "./color-palette.js"
import {
  TaskListIcon,
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeIcon,
  EllipsisVerticalIcon,
  ItalicIcon,
  MergeIcon,
  MinusColIcon,
  MinusRowIcon,
  PaletteIcon,
  PlusColIcon,
  PlusRowIcon,
  SplitIcon,
  TextColorIcon
} from "./icons.js"

export interface MarkdownTableEditorProps {
  renderCellEditor?: (input: React.ReactElement<React.TextareaHTMLAttributes<HTMLTextAreaElement>>) => React.ReactNode
  renderCellContent?: (text: string) => React.ReactNode
  source?: string
  data?: MarkdownTableData
  readOnly?: boolean
  onChange?: (newSource: string, newData: MarkdownTableData) => void
  onFocusAbove?: () => void
  onFocusBelow?: () => void
  onCopy?: () => void
  onDelete?: () => void
}

export const MarkdownTableEditor: React.FC<MarkdownTableEditorProps> = ({
  renderCellEditor = (input) => input,
  renderCellContent = (text) => text,
  source = "",
  data: initialData,
  readOnly = false,
  onChange,
  onFocusAbove,
  onFocusBelow,
  onCopy,
  onDelete
}) => {
  const [tableData, setTableData] = useState<MarkdownTableData>(() => {
    return initialData || parseMarkdownTable(source)
  })

  // Synchronize when external source changes
  useEffect(() => {
    if (source) {
      setTableData(parseMarkdownTable(source))
    }
  }, [source])

  const [selection, setSelection] = useState<TableRange | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [activeEdit, setActiveEdit] = useState<{ row: number; col: number } | null>(null)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [showTextPicker, setShowTextPicker] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [rawText, setRawText] = useState("")
  const [isEditingCaption, setIsEditingCaption] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showFocusSub, setShowFocusSub] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [cellMenu, setCellMenu] = useState<{ row: number; col: number; x: number; y: number } | null>(null)
  const cellMenuRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!cellMenu || !cellMenuRef.current) return
    const menu = cellMenuRef.current
    menu.style.left = `${Math.max(8, Math.min(cellMenu.x, window.innerWidth - menu.offsetWidth - 8))}px`
    menu.style.top = `${Math.max(8, Math.min(cellMenu.y, window.innerHeight - menu.offsetHeight - 8))}px`
    menu.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true })
    const close = () => setCellMenu(null)
    const outside = (event: MouseEvent) => { if (!menu.contains(event.target as Node)) close() }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close() }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const items = Array.from(menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"))
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus()
      }
    }
    const scroll = (event: Event) => { if (!menu.contains(event.target as Node)) close() }
    document.addEventListener("mousedown", outside)
    document.addEventListener("keydown", key)
    window.addEventListener("scroll", scroll, true)
    window.addEventListener("resize", close)
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", close) }
  }, [cellMenu])
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const menuPopupRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    if (!showMoreMenu) return
    const place = () => {
      const trigger = moreMenuRef.current?.getBoundingClientRect()
      const menu = menuPopupRef.current
      if (!trigger || !menu) return
      const width = menu.offsetWidth, height = menu.offsetHeight
      setMenuPosition({ left: Math.max(8, Math.min(trigger.right - width, window.innerWidth - width - 8)), top: Math.max(8, Math.min(trigger.bottom + 4, window.innerHeight - height - 8)) })
    }
    place()
    const close = () => { setShowMoreMenu(false); setShowFocusSub(false) }
    const scroll = (event: Event) => { if (!menuPopupRef.current?.contains(event.target as Node)) close() }
    window.addEventListener("resize", close)
    window.addEventListener("scroll", scroll, true)
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", scroll, true) }
  }, [showMoreMenu])
  useLayoutEffect(() => {
    const sub = submenuRef.current
    if (!showFocusSub || !sub) return
    sub.style.marginRight = "0"
    const parent = sub.parentElement!.getBoundingClientRect()
    sub.style.right = parent.left >= sub.offsetWidth + 8 ? "100%" : "auto"
    sub.style.left = parent.left >= sub.offsetWidth + 8 ? "auto" : "100%"
    const rect = sub.getBoundingClientRect()
    sub.style.top = `${-4 - Math.max(0, rect.bottom - window.innerHeight + 8)}px`
  }, [showFocusSub])
  const dragStartCellRef = useRef<{ row: number; col: number; moved: boolean } | null>(null)

  const emitChange = useCallback(
    (next: MarkdownTableData) => {
      setTableData(next)
      if (onChange) {
        const serialized = serializeMarkdownTable(next)
        onChange(serialized, next)
      }
    },
    [onChange]
  )

  // Selection range normalized
  const activeRange = useMemo(() => {
    if (selection) {
      return normalizeRange(selection.startRow, selection.startCol, selection.endRow, selection.endCol)
    }
    if (activeEdit) {
      return { startRow: activeEdit.row, startCol: activeEdit.col, endRow: activeEdit.row, endCol: activeEdit.col }
    }
    return null
  }, [selection, activeEdit])

  const isCellSelected = useCallback(
    (row: number, col: number) => {
      if (!activeRange) return false
      return (
        row >= activeRange.startRow &&
        row <= activeRange.endRow &&
        col >= activeRange.startCol &&
        col <= activeRange.endCol
      )
    },
    [activeRange]
  )

  // Check if current selection can be merged (> 1 cell)
  const canMerge = useMemo(() => {
    if (!activeRange) return false
    return activeRange.startRow !== activeRange.endRow || activeRange.startCol !== activeRange.endCol
  }, [activeRange])

  // Check if selected cell has a merge
  const canSplit = useMemo(() => {
    if (!selection) return false
    const info = getCellMergeInfo(tableData.merges, selection.startRow, selection.startCol)
    return info.isMaster || info.isCovered
  }, [selection, tableData.merges])

  // Mouse selection handling
  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    if (readOnly) return
    if (e.button !== 0) return // only left click

    if (activeEdit && activeEdit.row === row && activeEdit.col === col) {
      return // keep editing inside the cell input
    }

    setShowBgPicker(false)
    setShowTextPicker(false)

    if (e.shiftKey && selection) {
      setSelection({
        startRow: selection.startRow,
        startCol: selection.startCol,
        endRow: row,
        endCol: col
      })
      setIsDragging(false)
      dragStartCellRef.current = null
      setActiveEdit(null)
    } else {
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col })
      setIsDragging(true)
      dragStartCellRef.current = { row, col, moved: false }
    }
  }

  const handleCellMouseEnter = (row: number, col: number, e: React.MouseEvent) => {
    // If left mouse button is not actively pressed down, immediately stop dragging
    if (e.buttons !== 1) {
      if (isDragging) setIsDragging(false)
      dragStartCellRef.current = null
      return
    }
    if (!isDragging || !selection) return
    if (dragStartCellRef.current) {
      if (dragStartCellRef.current.row !== row || dragStartCellRef.current.col !== col) {
        dragStartCellRef.current.moved = true
        setActiveEdit(null)
      }
    }
    setSelection((prev) => (prev ? { ...prev, endRow: row, endCol: col } : null))
  }

  const handleCellMouseUp = () => {
    setIsDragging(false)
    dragStartCellRef.current = null
  }

  // Global mouseup / pointerup in capture phase to reliably release dragging
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartCellRef.current = null
    }
    window.addEventListener("mouseup", handleMouseUp, true)
    window.addEventListener("pointerup", handleMouseUp, true)
    document.addEventListener("mouseup", handleMouseUp, true)
    document.addEventListener("pointerup", handleMouseUp, true)
    return () => {
      window.removeEventListener("mouseup", handleMouseUp, true)
      window.removeEventListener("pointerup", handleMouseUp, true)
      document.removeEventListener("mouseup", handleMouseUp, true)
      document.removeEventListener("pointerup", handleMouseUp, true)
    }
  }, [])

  // Handle click outside table / toolbar: clear cell selection & close color pickers
  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return

      // If clicked outside the more menu popover/trigger, close it
      if (moreMenuRef.current && !moreMenuRef.current.contains(target) && !menuPopupRef.current?.contains(target)) {
        setShowMoreMenu(false)
        setShowFocusSub(false)
      }

      // If clicked inside the toolbar (including color picker popovers), keep selection
      if (menuPopupRef.current?.contains(target) || (toolbarRef.current && toolbarRef.current.contains(target))) {
        return
      }

      // If clicked outside toolbar, close color pickers
      setShowBgPicker(false)
      setShowTextPicker(false)

      // If clicked outside the table grid, clear selection, cell editor, and caption editor
      if (tableRef.current && !tableRef.current.contains(target)) {
        setSelection(null)
        setActiveEdit(null)
        setIsEditingCaption(false)
      }
    }

    document.addEventListener("mousedown", handleDocumentMouseDown, true)
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown, true)
    }
  }, [])

  // Cell Content Modification
  const handleCellChange = (row: number, col: number, text: string) => {
    const nextRows = tableData.rows.map((r, rIdx) => {
      if (rIdx !== row) return r
      const nextCells = r.cells.map((c, cIdx) => {
        if (cIdx !== col) return c
        return { ...c, text }
      })
      return { ...r, cells: nextCells }
    })
    emitChange({ ...tableData, rows: nextRows })
  }

  // Formatting actions
  const applyStyleToSelection = (stylePatch: Partial<MarkdownTableCell["style"]>) => {
    if (!activeRange) return
    const nextRows = tableData.rows.map((row, rIdx) => {
      if (rIdx < activeRange.startRow || rIdx > activeRange.endRow) return row
      const nextCells = row.cells.map((cell, cIdx) => {
        if (cIdx < activeRange.startCol || cIdx > activeRange.endCol) return cell
        const mergedStyle = { ...(cell.style || {}), ...stylePatch }
        // Clean empty values
        if (!mergedStyle.bgColor) delete mergedStyle.bgColor
        if (!mergedStyle.textColor) delete mergedStyle.textColor
        return { ...cell, style: mergedStyle }
      })
      return { ...row, cells: nextCells }
    })
    emitChange({ ...tableData, rows: nextRows })
  }

  const selectedCells = activeRange ? tableData.rows.flatMap((row, y) => row.cells.filter((_, x) => y >= activeRange.startRow && y <= activeRange.endRow && x >= activeRange.startCol && x <= activeRange.endCol)) : []
  const isTaskList = selectedCells.length > 0 && selectedCells.every((cell) => isTableTaskList(cell.text))
  const toggleTaskList = () => {
    if (!activeRange) return
    const rows = tableData.rows.map((row, y) => ({ ...row, cells: row.cells.map((cell, x) => y >= activeRange.startRow && y <= activeRange.endRow && x >= activeRange.startCol && x <= activeRange.endCol ? { ...cell, text: setTableTaskList(cell.text, !isTaskList) } : cell) }))
    setActiveEdit(null)
    emitChange({ ...tableData, rows })
  }

  // Merge selected cells
  const handleMergeSelection = () => {
    if (!activeRange || !canMerge) return
    const nextMerges = mergeSelection(
      tableData.merges,
      activeRange.startRow,
      activeRange.startCol,
      activeRange.endRow,
      activeRange.endCol
    )
    emitChange({ ...tableData, merges: nextMerges })
    setSelection({
      startRow: activeRange.startRow,
      startCol: activeRange.startCol,
      endRow: activeRange.startRow,
      endCol: activeRange.startCol
    })
  }

  // Split merged cell
  const handleSplitCell = () => {
    if (!selection) return
    const nextMerges = splitMergeAt(tableData.merges, selection.startRow, selection.startCol)
    emitChange({ ...tableData, merges: nextMerges })
  }

  // Row operations
  const insertRow = (index: number) => {
    const colCount = tableData.columns.length
    const newCells: MarkdownTableCell[] = Array.from({ length: colCount }, () => ({
      id: generateCellId(),
      text: "",
      style: {}
    }))
    const newRow: MarkdownTableRow = { isHeader: false, cells: newCells }
    const nextRows = [...tableData.rows]
    nextRows.splice(index, 0, newRow)
    const nextMerges = adjustMergesOnInsertRow(tableData.merges, index)
    emitChange({ ...tableData, rows: nextRows, merges: nextMerges })
  }

  const deleteRow = (index: number) => {
    if (tableData.rows.length <= 1) return // Keep at least 1 row
    const nextRows = tableData.rows.filter((_, i) => i !== index)
    const nextMerges = adjustMergesOnDeleteRow(tableData.merges, index)
    emitChange({ ...tableData, rows: nextRows, merges: nextMerges })
    setSelection(null)
    setActiveEdit(null)
  }

  // Column operations
  const insertCol = (index: number) => {
    const nextColumns: MarkdownTableColumn[] = [...tableData.columns]
    nextColumns.splice(index, 0, { width: 140, align: "left" })

    const nextRows = tableData.rows.map((row) => {
      const nextCells = [...row.cells]
      nextCells.splice(index, 0, { id: generateCellId(), text: "", style: {} })
      return { ...row, cells: nextCells }
    })
    const nextMerges = adjustMergesOnInsertCol(tableData.merges, index)
    emitChange({ ...tableData, columns: nextColumns, rows: nextRows, merges: nextMerges })
  }

  const deleteCol = (index: number) => {
    if (tableData.columns.length <= 1) return // Keep at least 1 column
    const nextColumns = tableData.columns.filter((_, i) => i !== index)
    const nextRows = tableData.rows.map((row) => ({
      ...row,
      cells: row.cells.filter((_, i) => i !== index)
    }))
    const nextMerges = adjustMergesOnDeleteCol(tableData.merges, index)
    emitChange({ ...tableData, columns: nextColumns, rows: nextRows, merges: nextMerges })
    setSelection(null)
    setActiveEdit(null)
  }

  const deleteColRange = useCallback(
    (startCol: number, endCol: number) => {
      if (tableData.columns.length <= 1) return
      const colsToDelete = new Set<number>()
      for (let c = startCol; c <= endCol; c++) colsToDelete.add(c)
      if (colsToDelete.size >= tableData.columns.length) return
      const nextColumns = tableData.columns.filter((_, i) => !colsToDelete.has(i))
      const nextRows = tableData.rows.map((row) => ({
        ...row,
        cells: row.cells.filter((_, i) => !colsToDelete.has(i))
      }))
      let nextMerges = tableData.merges
      const sorted = Array.from(colsToDelete).sort((a, b) => b - a)
      for (const c of sorted) {
        nextMerges = adjustMergesOnDeleteCol(nextMerges, c)
      }
      emitChange({ ...tableData, columns: nextColumns, rows: nextRows, merges: nextMerges })
      setSelection(null)
      setActiveEdit(null)
    },
    [tableData, emitChange]
  )

  const deleteRowRange = useCallback(
    (startRow: number, endRow: number) => {
      if (tableData.rows.length <= 1) return
      const rowsToDelete = new Set<number>()
      for (let r = startRow; r <= endRow; r++) rowsToDelete.add(r)
      if (rowsToDelete.size >= tableData.rows.length) return
      const nextRows = tableData.rows.filter((_, i) => !rowsToDelete.has(i))
      let nextMerges = tableData.merges
      const sorted = Array.from(rowsToDelete).sort((a, b) => b - a)
      for (const r of sorted) {
        nextMerges = adjustMergesOnDeleteRow(nextMerges, r)
      }
      emitChange({ ...tableData, rows: nextRows, merges: nextMerges })
      setSelection(null)
      setActiveEdit(null)
    },
    [tableData, emitChange]
  )

  const handleDeleteSelectionOrCell = useCallback(() => {
    if (readOnly || !activeRange) return

    // 1. Check if any cell in the selection has non-empty text
    let hasContent = false
    for (let r = activeRange.startRow; r <= activeRange.endRow; r++) {
      for (let c = activeRange.startCol; c <= activeRange.endCol; c++) {
        const text = tableData.rows[r]?.cells[c]?.text
        if (text && text.trim().length > 0) {
          hasContent = true
          break
        }
      }
      if (hasContent) break
    }

    // If any cell has content, clear content across all selected cells
    if (hasContent) {
      const nextRows = tableData.rows.map((row, rIdx) => {
        if (rIdx < activeRange.startRow || rIdx > activeRange.endRow) return row
        const nextCells = row.cells.map((cell, cIdx) => {
          if (cIdx < activeRange.startCol || cIdx > activeRange.endCol) return cell
          return { ...cell, text: "" }
        })
        return { ...row, cells: nextCells }
      })
      emitChange({ ...tableData, rows: nextRows })
      setActiveEdit(null)
      return
    }

    // 2. All selected cells have NO content -> delete cell / column / row
    const targetCol = activeRange.startCol
    const targetRow = activeRange.startRow

    // Check if the selected column(s) are completely empty across all rows
    let isColEntirelyEmpty = true
    for (let c = activeRange.startCol; c <= activeRange.endCol; c++) {
      for (const r of tableData.rows) {
        if (r.cells[c]?.text?.trim()) {
          isColEntirelyEmpty = false
          break
        }
      }
      if (!isColEntirelyEmpty) break
    }

    // Check if the selected row(s) are completely empty across all columns
    let isRowEntirelyEmpty = true
    for (let r = activeRange.startRow; r <= activeRange.endRow; r++) {
      const row = tableData.rows[r]
      if (row && row.cells.some((c) => c.text?.trim())) {
        isRowEntirelyEmpty = false
        break
      }
    }

    // If column is completely empty, delete column(s)
    if (isColEntirelyEmpty && tableData.columns.length > 1) {
      deleteColRange(activeRange.startCol, activeRange.endCol)
      return
    }

    // If row is completely empty, delete row(s)
    if (isRowEntirelyEmpty && tableData.rows.length > 1) {
      deleteRowRange(activeRange.startRow, activeRange.endRow)
      return
    }

    // If cell in header row (row 0) is empty, prefer deleting column
    if (activeRange.startRow === 0 && tableData.columns.length > 1) {
      deleteColRange(activeRange.startCol, activeRange.endCol)
      return
    }

    // If single cell, compare emptiness ratio of column vs row
    const isSingleCell =
      activeRange.startRow === activeRange.endRow && activeRange.startCol === activeRange.endCol

    if (isSingleCell) {
      const emptyInCol = tableData.rows.filter((row) => !row.cells[targetCol]?.text?.trim()).length
      const emptyInRow = tableData.rows[targetRow]?.cells.filter((cell) => !cell.text?.trim()).length ?? 0
      const colEmptyRatio = emptyInCol / tableData.rows.length
      const rowEmptyRatio = emptyInRow / tableData.columns.length

      if (colEmptyRatio >= rowEmptyRatio && tableData.columns.length > 1) {
        deleteColRange(targetCol, targetCol)
      } else if (tableData.rows.length > 1) {
        deleteRowRange(targetRow, targetRow)
      } else if (tableData.columns.length > 1) {
        deleteColRange(targetCol, targetCol)
      }
      return
    }

    // If multiple cells selected
    const colSpan = activeRange.endCol - activeRange.startCol + 1
    const rowSpan = activeRange.endRow - activeRange.startRow + 1
    if (colSpan <= rowSpan && tableData.columns.length > colSpan) {
      deleteColRange(activeRange.startCol, activeRange.endCol)
    } else if (tableData.rows.length > rowSpan) {
      deleteRowRange(activeRange.startRow, activeRange.endRow)
    } else if (tableData.columns.length > colSpan) {
      deleteColRange(activeRange.startCol, activeRange.endCol)
    }
  }, [readOnly, activeRange, tableData, emitChange, deleteColRange, deleteRowRange])

  useEffect(() => {
    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return
      if (!activeRange) return

      const target = e.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (target.classList.contains("vessel-cell-editor") && (e.key === "Delete" || e.key === "Backspace")) {
          const inputEl = target as HTMLInputElement
          if (!inputEl.value) {
            e.preventDefault()
            handleDeleteSelectionOrCell()
          }
        }
        return
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        handleDeleteSelectionOrCell()
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown, true)
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown, true)
    }
  }, [readOnly, activeRange, handleDeleteSelectionOrCell])

  // Toggle raw mode
  const handleToggleRaw = () => {
    if (!showRaw) {
      setRawText(serializeMarkdownTable(tableData))
      setShowRaw(true)
    } else {
      const parsed = parseMarkdownTable(rawText)
      emitChange(parsed)
      setShowRaw(false)
    }
  }

  const handleCopy = () => {
    setShowMoreMenu(false)
    setShowFocusSub(false)
    if (onCopy) {
      onCopy()
    } else {
      const textToCopy = source || serializeMarkdownTable(tableData)
      void navigator.clipboard?.writeText(textToCopy)
    }
  }

  const handleDelete = () => {
    setShowMoreMenu(false)
    setShowFocusSub(false)
    if (onDelete) {
      onDelete()
    }
  }

  const handleFocusAbove = () => {
    setShowMoreMenu(false)
    setShowFocusSub(false)
    onFocusAbove?.()
  }

  const handleFocusBelow = () => {
    setShowMoreMenu(false)
    setShowFocusSub(false)
    onFocusBelow?.()
  }

  const curRow = selection?.startRow ?? activeEdit?.row ?? 0
  const curCol = selection?.startCol ?? activeEdit?.col ?? 0
  const currentCell = tableData.rows[curRow]?.cells[curCol]
  const curAlign = currentCell?.style?.align || tableData.columns[curCol]?.align || "left"
  const isBold = !!currentCell?.style?.bold
  const isItalic = !!currentCell?.style?.italic

  return (
    <div
      className="vessel-markdown-table-wrapper"
      ref={containerRef}
      onMouseUp={() => setIsDragging(false)}
      onPointerUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      {cellMenu && !readOnly && createPortal(
        <div ref={cellMenuRef} role="menu" aria-label="单元格操作" className="vessel-dropdown-menu" style={{ position: "fixed", left: cellMenu.x, top: cellMenu.y, right: "auto", marginTop: 0, zIndex: 350, minWidth: 180 }} onMouseDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
          {([
            ["↑", "在上方插入一行", () => insertRow(cellMenu.row), false],
            ["↓", "在下方插入一行", () => insertRow(cellMenu.row + 1), false],
            ["←", "在左边插入一列", () => insertCol(cellMenu.col), false],
            ["→", "在右边插入一列", () => insertCol(cellMenu.col + 1), false],
            ["", "删除当前行", () => deleteRow(cellMenu.row), tableData.rows.length <= 1],
            ["", "删除当前列", () => deleteCol(cellMenu.col), tableData.columns.length <= 1]
          ] as const).map(([icon, label, action, disabled], index) => <React.Fragment key={label}>
            {index === 4 && <div className="vessel-menu-divider" />}
            <button type="button" role="menuitem" disabled={disabled} className={`vessel-menu-item ${index >= 4 ? "vessel-menu-item-danger" : ""}`} style={{ border: 0, background: "transparent", justifyContent: "flex-start", gap: 8, opacity: disabled ? 0.4 : 1 }} onClick={() => { action(); setCellMenu(null) }}><span aria-hidden>{icon}</span>{label}</button>
          </React.Fragment>)}
        </div>, document.body
      )}
      {!readOnly && (
        <div className="vessel-table-toolbar" ref={toolbarRef}>
          {/* Merge & Split */}
          <div className="vessel-table-toolbar-group">
            <button
              type="button"
              className="vessel-table-btn"
              disabled={!canMerge}
              onClick={handleMergeSelection}
              title="合并所选单元格"
            >
              <MergeIcon />
              <span>合并</span>
            </button>
            <button
              type="button"
              className="vessel-table-btn"
              disabled={!canSplit}
              onClick={handleSplitCell}
              title="拆分单元格"
            >
              <SplitIcon />
              <span>拆分</span>
            </button>
          </div>

          <div className="vessel-table-toolbar-divider" />

          {/* Background Color Picker */}
          <div className="vessel-table-toolbar-group" style={{ position: "relative" }}>
            <button
              type="button"
              className="vessel-table-btn"
              disabled={!activeRange}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowBgPicker((v) => !v)
                setShowTextPicker(false)
              }}
              title="单元格背景色"
            >
              <PaletteIcon />
              <span>背景</span>
              <ChevronDownIcon />
            </button>
            {showBgPicker && (
              <div className="vessel-color-popover">
                {BG_COLORS.map((c) => (
                  <div
                    key={c.label}
                    className="vessel-color-swatch"
                    style={{ backgroundColor: c.value || "#ffffff", borderColor: c.border || "rgba(0,0,0,0.15)" }}
                    title={c.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyStyleToSelection({ bgColor: c.value })
                      setShowBgPicker(false)
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Text Color Picker */}
          <div className="vessel-table-toolbar-group" style={{ position: "relative" }}>
            <button
              type="button"
              className="vessel-table-btn"
              disabled={!activeRange}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowTextPicker((v) => !v)
                setShowBgPicker(false)
              }}
              title="字体颜色"
            >
              <TextColorIcon />
              <span>文字</span>
              <ChevronDownIcon />
            </button>
            {showTextPicker && (
              <div className="vessel-color-popover">
                {TEXT_COLORS.map((c) => (
                  <div
                    key={c.label}
                    className="vessel-color-swatch"
                    style={{ backgroundColor: c.value || "#111827" }}
                    title={c.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyStyleToSelection({ textColor: c.value })
                      setShowTextPicker(false)
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Text Styles: Bold, Italic */}
          <div className="vessel-table-toolbar-group">
            <button
              type="button"
              className={`vessel-table-btn vessel-table-btn-icon ${activeRange && isBold ? "active" : ""}`}
              disabled={!activeRange}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                applyStyleToSelection({ bold: !isBold })
              }}
              title="加粗"
            >
              <BoldIcon />
            </button>
            <button
              type="button"
              className={`vessel-table-btn vessel-table-btn-icon ${activeRange && isItalic ? "active" : ""}`}
              disabled={!activeRange}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                applyStyleToSelection({ italic: !isItalic })
              }}
              title="斜体"
            >
              <ItalicIcon />
            </button>
          </div>

          <div className="vessel-table-toolbar-divider" />

          {/* Alignment */}
          <div className="vessel-table-toolbar-group">
            <button
              type="button"
              className={`vessel-table-btn vessel-table-btn-icon ${activeRange && curAlign === "left" ? "active" : ""}`}
              disabled={!activeRange}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyStyleToSelection({ align: "left" })}
              title="左对齐"
            >
              <AlignLeftIcon />
            </button>
            <button
              type="button"
              className={`vessel-table-btn vessel-table-btn-icon ${activeRange && curAlign === "center" ? "active" : ""}`}
              disabled={!activeRange}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyStyleToSelection({ align: "center" })}
              title="居中"
            >
              <AlignCenterIcon />
            </button>
            <button
              type="button"
              className={`vessel-table-btn vessel-table-btn-icon ${activeRange && curAlign === "right" ? "active" : ""}`}
              disabled={!activeRange}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyStyleToSelection({ align: "right" })}
              title="右对齐"
            >
              <AlignRightIcon />
            </button>
          </div>

          <div className="vessel-table-toolbar-divider" />

          <div className="vessel-table-toolbar-group">
            <button type="button" className={`vessel-table-btn vessel-table-btn-icon ${isTaskList ? "active" : ""}`} title="任务列表" aria-label="任务列表" aria-pressed={isTaskList} disabled={!activeRange} onMouseDown={(event) => event.preventDefault()} onClick={toggleTaskList}><TaskListIcon /></button>
          </div>
          <div className="vessel-table-toolbar-divider" />
          {/* Rows & Columns Operations */}
          <div className="vessel-table-toolbar-group">
            <button
              type="button"
              className="vessel-table-btn"
              onClick={() => insertRow(curRow + 1)}
              title="在下方插入行"
            >
              <PlusRowIcon />
              <span>+行</span>
            </button>
            <button
              type="button"
              className="vessel-table-btn"
              onClick={() => insertCol(curCol + 1)}
              title="在右侧插入列"
            >
              <PlusColIcon />
              <span>+列</span>
            </button>
            <button
              type="button"
              className="vessel-table-btn"
              disabled={tableData.rows.length <= 1}
              onClick={() => deleteRow(curRow)}
              title="删除当前行"
            >
              <MinusRowIcon />
              <span>-行</span>
            </button>
            <button
              type="button"
              className="vessel-table-btn"
              disabled={tableData.columns.length <= 1}
              onClick={() => deleteCol(curCol)}
              title="删除当前列"
            >
              <MinusColIcon />
              <span>-列</span>
            </button>
          </div>

          <div className="vessel-table-toolbar-divider" />

          {/* Raw JSON toggle */}
          <button
            type="button"
            className={`vessel-table-btn ${showRaw ? "active" : ""}`}
            onClick={handleToggleRaw}
            title={showRaw ? "返回表格视图" : "查看/编辑 JSON 源码"}
          >
            <CodeIcon />
            <span>{showRaw ? "表格" : "JSON"}</span>
          </button>

          <div className="vessel-table-toolbar-divider" />

          {/* More menu (Context menu: Focus above/below, Copy, Delete) */}
          <div className="vessel-table-toolbar-group" ref={moreMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              className={`vessel-table-btn vessel-table-btn-icon vessel-table-btn-more ${showMoreMenu ? "active" : ""}`}
              onClick={() => {
                setShowMoreMenu((prev) => !prev)
                setShowFocusSub(false)
              }}
              title="更多选项"
            >
              <EllipsisVerticalIcon />
            </button>

            {showMoreMenu && createPortal(
              <div ref={menuPopupRef} style={{ position: "fixed", left: menuPosition.left, top: menuPosition.top, right: "auto", marginTop: 0, zIndex: 350 }} className="vessel-dropdown-menu" onMouseDown={(e) => e.stopPropagation()}>
                {/* 聚焦 with submenu */}
                <div
                  className="vessel-menu-item vessel-menu-item-sub"
                  onMouseEnter={() => setShowFocusSub(true)}
                  onMouseLeave={() => setShowFocusSub(false)}
                >
                  <span>聚焦</span>
                  <ChevronRightIcon />
                  {showFocusSub && (
                    <div ref={submenuRef} className="vessel-dropdown-submenu">
                      <div className="vessel-menu-item" onClick={handleFocusAbove}>
                        在上方聚焦
                      </div>
                      <div className="vessel-menu-item" onClick={handleFocusBelow}>
                        在下方聚焦
                      </div>
                    </div>
                  )}
                </div>

                {/* 复制 */}
                <div className="vessel-menu-item" onClick={handleCopy}>
                  <span>复制</span>
                </div>

                <div className="vessel-menu-divider" />

                {/* 删除 */}
                <div className="vessel-menu-item vessel-menu-item-danger" onClick={handleDelete}>
                  <span>删除</span>
                </div>
              </div>, document.body
            )}
          </div>
        </div>
      )}

      {showRaw ? (
        <textarea
          className="vessel-table-raw-editor"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
      ) : (
        <div className="vessel-table-container">
          <div className={readOnly ? undefined : "vessel-table-edge-layout"}>
          <table className="vessel-table-grid" ref={tableRef}>
            {(tableData.caption || !readOnly) && (
              <caption
                className="vessel-table-caption"
                onDoubleClick={() => {
                  if (!readOnly) setIsEditingCaption(true)
                }}
              >
                {isEditingCaption ? (
                  <input
                    autoFocus
                    className="vessel-caption-editor"
                    value={tableData.caption || ""}
                    placeholder="表格标题"
                    onChange={(e) => emitChange({ ...tableData, caption: e.target.value })}
                    onBlur={() => setIsEditingCaption(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        setIsEditingCaption(false)
                      }
                    }}
                    onFocus={(e) => {
                      const len = e.currentTarget.value.length
                      e.currentTarget.setSelectionRange(len, len)
                    }}
                  />
                ) : (
                  <div className="vessel-caption-text" title={readOnly ? undefined : "双击编辑标题"}>
                    {tableData.caption || (readOnly ? "" : "表格标题")}
                  </div>
                )}
              </caption>
            )}
            <colgroup>
              {tableData.columns.map((col, idx) => (
                <col key={idx} style={{ width: col.width ? `${col.width}px` : "auto" }} />
              ))}
            </colgroup>
            <tbody>
              {tableData.rows.map((row, rIdx) => (
                <tr key={rIdx} className="vessel-table-row">
                  {row.cells.map((cell, cIdx) => {
                    const mergeInfo = getCellMergeInfo(tableData.merges, rIdx, cIdx)
                    if (mergeInfo.isCovered) {
                      return null // Covered by a merged cell
                    }

                    const selected = isCellSelected(rIdx, cIdx)
                    const editing = activeEdit?.row === rIdx && activeEdit?.col === cIdx
                    const CellTag = row.isHeader ? "th" : "td"
                    const isHeaderCell = row.isHeader

                    const style: React.CSSProperties = {
                      backgroundColor: cell.style?.bgColor || undefined,
                      color: cell.style?.textColor || undefined,
                      fontWeight: cell.style?.bold ? 600 : undefined,
                      fontStyle: cell.style?.italic ? "italic" : undefined,
                      textAlign: cell.style?.align || tableData.columns[cIdx]?.align || "left"
                    }

                    const hasCustomBg = !!cell.style?.bgColor
                    const isFirstCol = cIdx === 0
                    const isLastCol = cIdx + mergeInfo.colSpan >= tableData.columns.length
                    const isLastRow = rIdx + mergeInfo.rowSpan >= tableData.rows.length

                    const isSelTop = !!(selected && activeRange && rIdx === activeRange.startRow)
                    const isSelBottom = !!(selected && activeRange && rIdx + mergeInfo.rowSpan - 1 === activeRange.endRow)
                    const isSelLeft = !!(selected && activeRange && cIdx === activeRange.startCol)
                    const isSelRight = !!(selected && activeRange && cIdx + mergeInfo.colSpan - 1 === activeRange.endCol)

                    const cellClasses = [
                      isHeaderCell ? "vessel-table-th" : "vessel-table-td",
                      selected ? "vessel-cell-selected" : "",
                      isSelTop ? "vessel-sel-top" : "",
                      isSelBottom ? "vessel-sel-bottom" : "",
                      isSelLeft ? "vessel-sel-left" : "",
                      isSelRight ? "vessel-sel-right" : "",
                      hasCustomBg ? "vessel-cell-custom-bg" : "",
                      isFirstCol ? "vessel-cell-edge-left" : "",
                      isLastCol ? "vessel-cell-edge-right" : "",
                      isLastRow ? "vessel-cell-edge-bottom" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")

                    return (
                      <CellTag
                        key={cell.id}
                        rowSpan={mergeInfo.rowSpan > 1 ? mergeInfo.rowSpan : undefined}
                        colSpan={mergeInfo.colSpan > 1 ? mergeInfo.colSpan : undefined}
                        className={cellClasses}
                        style={style}
                        onMouseDown={(e) => handleCellMouseDown(rIdx, cIdx, e)}
                        onMouseEnter={(e) => handleCellMouseEnter(rIdx, cIdx, e)}
                        onMouseUp={handleCellMouseUp}
                        onContextMenu={(event) => {
                          if (readOnly) return
                          event.preventDefault()
                          event.stopPropagation()
                          setIsDragging(false)
                          setActiveEdit(null)
                          setSelection({ startRow: rIdx, endRow: rIdx, startCol: cIdx, endCol: cIdx })
                          setShowMoreMenu(false)
                          setCellMenu({ row: rIdx, col: cIdx, x: event.clientX, y: event.clientY })
                        }}
                        onDoubleClick={() => {
                          if (!readOnly) setActiveEdit({ row: rIdx, col: cIdx })
                        }}
                      >
                        {editing ? renderCellEditor(
                          <CellTextarea
                            autoFocus
                            className="vessel-cell-editor"
                            style={{ color: cell.style?.textColor || undefined }}
                            value={cell.text}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            onBlur={() => setActiveEdit(null)}
                            onFocus={(e) => {
                              const len = e.currentTarget.value.length
                              e.currentTarget.setSelectionRange(len, len)
                            }}
                            onKeyDown={(e) => {
                              if (e.nativeEvent.isComposing) return
                              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault()
                                setActiveEdit(null)
                              } else if (e.key === "Tab") {
                                e.preventDefault()
                                const nextCol = (cIdx + 1) % tableData.columns.length
                                const nextRow = nextCol === 0 ? (rIdx + 1) % tableData.rows.length : rIdx
                                setSelection({ startRow: nextRow, startCol: nextCol, endRow: nextRow, endCol: nextCol })
                                setActiveEdit({ row: nextRow, col: nextCol })
                              } else if (e.key === "Escape") {
                                setActiveEdit(null)
                              } else if ((e.key === "Delete" || e.key === "Backspace") && !e.currentTarget.value) {
                                e.preventDefault()
                                handleDeleteSelectionOrCell()
                              }
                            }}
                          />
                        ) : (
                          <div
                            className="vessel-cell-content"
                            style={{ color: cell.style?.textColor || undefined }}
                          >
                            {cell.text.split("\n").map((line, lineIndex) => {
                              const task = parseTableTask(line)
                              return task ? <div key={lineIndex} className="vessel-table-task"><input type="checkbox" checked={task.checked} disabled={readOnly} aria-label={task.text || "任务"} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onChange={(event) => handleCellChange(rIdx, cIdx, checkTableTask(cell.text, lineIndex, event.target.checked))} /><span className={task.checked ? "vessel-table-task-done" : undefined}>{task.text ? renderCellContent(task.text) : "\u00A0"}</span></div> : <div key={lineIndex}>{line ? renderCellContent(line) : "\u00A0"}</div>
                            })}
                          </div>
                        )}
                      </CellTag>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && <>
            <button type="button" className="vessel-table-edge-add vessel-table-edge-column" aria-label="在表格右侧新增列" title="在表格右侧新增列" onMouseDown={(event) => event.preventDefault()} onClick={() => insertCol(tableData.columns.length)}><span aria-hidden="true">+</span></button>
            <button type="button" className="vessel-table-edge-add vessel-table-edge-row" aria-label="在表格底部新增行" title="在表格底部新增行" onMouseDown={(event) => event.preventDefault()} onClick={() => insertRow(tableData.rows.length)}><span aria-hidden="true">+</span></button>
          </>}
          </div>
        </div>
      )}
    </div>
  )
}
