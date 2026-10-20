import type { MarkdownTableCell, MarkdownTableColumn, MarkdownTableData, MarkdownTableMerge, MarkdownTableRow } from "./types.js"

let idCounter = 0
export function generateCellId(): string {
  idCounter += 1
  return `c_${Date.now().toString(36)}_${idCounter}`
}

export function createDefaultTable(): MarkdownTableData {
  return {
    version: 1,
    caption: "高级表格",
    columns: [
      { align: "left" },
      { align: "left" },
      { align: "right" }
    ],
    rows: [
      {
        isHeader: true,
        cells: [
          { id: generateCellId(), text: "Status", style: { bold: true } },
          { id: generateCellId(), text: "Email", style: { bold: true } },
          { id: generateCellId(), text: "Amount", style: { bold: true } }
        ]
      },
      {
        cells: [
          { id: generateCellId(), text: "Success", style: {} },
          { id: generateCellId(), text: "ken99@example.com", style: {} },
          { id: generateCellId(), text: "$316.00", style: { bold: true } }
        ]
      },
      {
        cells: [
          { id: generateCellId(), text: "Success", style: {} },
          { id: generateCellId(), text: "abe45@example.com", style: {} },
          { id: generateCellId(), text: "$242.00", style: { bold: true } }
        ]
      },
      {
        cells: [
          { id: generateCellId(), text: "Processing", style: {} },
          { id: generateCellId(), text: "monserrat44@example.com", style: {} },
          { id: generateCellId(), text: "$837.00", style: { bold: true } }
        ]
      },
      {
        cells: [
          { id: generateCellId(), text: "Success", style: {} },
          { id: generateCellId(), text: "silas22@example.com", style: {} },
          { id: generateCellId(), text: "$874.00", style: { bold: true } }
        ]
      },
      {
        cells: [
          { id: generateCellId(), text: "Failed", style: {} },
          { id: generateCellId(), text: "carmella@example.com", style: {} },
          { id: generateCellId(), text: "$721.00", style: { bold: true } }
        ]
      }
    ],
    merges: []
  }
}

/** Parses raw string into a normalized MarkdownTableData structure. */
export function parseMarkdownTable(source: string): MarkdownTableData {
  const trimmed = source.trim()
  if (!trimmed) {
    return createDefaultTable()
  }

  let raw: any
  try {
    raw = JSON.parse(trimmed)
  } catch {
    // If raw is not valid JSON, create default table with first cell showing a hint or raw snippet
    const fallback = createDefaultTable()
    if (trimmed.length > 0) {
      fallback.rows[1].cells[1].text = trimmed.slice(0, 100)
    }
    return fallback
  }

  if (!raw || typeof raw !== "object") {
    return createDefaultTable()
  }

  const rawRows = Array.isArray(raw.rows) ? raw.rows : []
  let maxCols = Array.isArray(raw.columns) ? raw.columns.length : 0

  for (const r of rawRows) {
    if (r && Array.isArray(r.cells)) {
      maxCols = Math.max(maxCols, r.cells.length)
    }
  }

  if (maxCols === 0) maxCols = 3
  const rowCount = Math.max(1, rawRows.length)

  // Normalize columns
  const columns: MarkdownTableColumn[] = []
  for (let c = 0; c < maxCols; c++) {
    const rawCol = Array.isArray(raw.columns) ? raw.columns[c] : undefined
    columns.push({
      width: typeof rawCol?.width === "number" ? rawCol.width : 140,
      align: rawCol?.align === "center" || rawCol?.align === "right" ? rawCol.align : "left"
    })
  }

  // Normalize rows
  const rows: MarkdownTableRow[] = []
  for (let r = 0; r < rowCount; r++) {
    const rawRow = rawRows[r]
    const isHeader = rawRow ? Boolean(rawRow.isHeader ?? (r === 0)) : (r === 0)
    const cells: MarkdownTableCell[] = []
    const rawCells = Array.isArray(rawRow?.cells) ? rawRow.cells : []

    for (let c = 0; c < maxCols; c++) {
      const cellData = rawCells[c]
      if (cellData && typeof cellData === "object") {
        cells.push({
          id: typeof cellData.id === "string" && cellData.id ? cellData.id : generateCellId(),
          text: typeof cellData.text === "string" ? cellData.text : String(cellData.text ?? ""),
          style: cellData.style && typeof cellData.style === "object" ? { ...cellData.style } : {}
        })
      } else {
        cells.push({
          id: generateCellId(),
          text: typeof cellData === "string" || typeof cellData === "number" ? String(cellData) : "",
          style: {}
        })
      }
    }
    rows.push({ isHeader, cells })
  }

  // Normalize merges
  const rawMerges = Array.isArray(raw.merges) ? raw.merges : []
  const merges: MarkdownTableMerge[] = []

  for (const m of rawMerges) {
    if (
      typeof m?.startRow === "number" &&
      typeof m?.startCol === "number" &&
      typeof m?.endRow === "number" &&
      typeof m?.endCol === "number"
    ) {
      const sr = Math.max(0, Math.min(rowCount - 1, Math.min(m.startRow, m.endRow)))
      const er = Math.max(0, Math.min(rowCount - 1, Math.max(m.startRow, m.endRow)))
      const sc = Math.max(0, Math.min(maxCols - 1, Math.min(m.startCol, m.endCol)))
      const ec = Math.max(0, Math.min(maxCols - 1, Math.max(m.startCol, m.endCol)))

      if (sr !== er || sc !== ec) {
        merges.push({ startRow: sr, startCol: sc, endRow: er, endCol: ec })
      }
    }
  }

  return {
    version: 1,
    caption: typeof raw.caption === "string" ? raw.caption : "",
    columns,
    rows,
    merges
  }
}
