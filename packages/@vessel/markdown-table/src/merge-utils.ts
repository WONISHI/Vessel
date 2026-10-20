import type { MarkdownTableMerge, TableRange } from "./types.js"

export function normalizeRange(r1: number, c1: number, r2: number, c2: number): TableRange {
  return {
    startRow: Math.min(r1, r2),
    startCol: Math.min(c1, c2),
    endRow: Math.max(r1, r2),
    endCol: Math.max(c1, c2)
  }
}

export interface CellMergeInfo {
  isMaster: boolean
  isCovered: boolean
  rowSpan: number
  colSpan: number
  merge?: MarkdownTableMerge
}

export function getCellMergeInfo(merges: MarkdownTableMerge[], row: number, col: number): CellMergeInfo {
  for (const m of merges) {
    if (row >= m.startRow && row <= m.endRow && col >= m.startCol && col <= m.endCol) {
      if (row === m.startRow && col === m.startCol) {
        return {
          isMaster: true,
          isCovered: false,
          rowSpan: m.endRow - m.startRow + 1,
          colSpan: m.endCol - m.startCol + 1,
          merge: m
        }
      }
      return {
        isMaster: false,
        isCovered: true,
        rowSpan: 1,
        colSpan: 1,
        merge: m
      }
    }
  }
  return {
    isMaster: false,
    isCovered: false,
    rowSpan: 1,
    colSpan: 1
  }
}

export function rangesOverlap(a: TableRange, b: TableRange): boolean {
  return !(
    a.endRow < b.startRow ||
    a.startRow > b.endRow ||
    a.endCol < b.startCol ||
    a.startCol > b.endCol
  )
}

/** Merges a selection range. Filters out any existing merges that intersect with this range. */
export function mergeSelection(
  merges: MarkdownTableMerge[],
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): MarkdownTableMerge[] {
  const norm = normalizeRange(startRow, startCol, endRow, endCol)
  if (norm.startRow === norm.endRow && norm.startCol === norm.endCol) {
    return merges
  }
  // Remove any existing merges that overlap with this new range
  const remaining = merges.filter((m) => !rangesOverlap(m, norm))
  return [...remaining, norm]
}

/** Splits (removes) any merge that contains (row, col). */
export function splitMergeAt(merges: MarkdownTableMerge[], row: number, col: number): MarkdownTableMerge[] {
  return merges.filter((m) => !(row >= m.startRow && row <= m.endRow && col >= m.startCol && col <= m.endCol))
}

/** Updates merges after a row is inserted at rowIndex. */
export function adjustMergesOnInsertRow(merges: MarkdownTableMerge[], rowIndex: number): MarkdownTableMerge[] {
  return merges.map((m) => {
    if (rowIndex <= m.startRow) {
      return { ...m, startRow: m.startRow + 1, endRow: m.endRow + 1 }
    }
    if (rowIndex <= m.endRow) {
      return { ...m, endRow: m.endRow + 1 }
    }
    return m
  })
}

/** Updates merges after a row at rowIndex is deleted. */
export function adjustMergesOnDeleteRow(merges: MarkdownTableMerge[], rowIndex: number): MarkdownTableMerge[] {
  const next: MarkdownTableMerge[] = []
  for (const m of merges) {
    if (rowIndex < m.startRow) {
      next.push({ ...m, startRow: m.startRow - 1, endRow: m.endRow - 1 })
    } else if (rowIndex > m.endRow) {
      next.push(m)
    } else {
      // Row is within the merge
      const newEnd = m.endRow - 1
      if (newEnd >= m.startRow && (newEnd > m.startRow || m.endCol > m.startCol)) {
        next.push({ ...m, endRow: newEnd })
      }
    }
  }
  return next
}

/** Updates merges after a column is inserted at colIndex. */
export function adjustMergesOnInsertCol(merges: MarkdownTableMerge[], colIndex: number): MarkdownTableMerge[] {
  return merges.map((m) => {
    if (colIndex <= m.startCol) {
      return { ...m, startCol: m.startCol + 1, endCol: m.endCol + 1 }
    }
    if (colIndex <= m.endCol) {
      return { ...m, endCol: m.endCol + 1 }
    }
    return m
  })
}

/** Updates merges after a column at colIndex is deleted. */
export function adjustMergesOnDeleteCol(merges: MarkdownTableMerge[], colIndex: number): MarkdownTableMerge[] {
  const next: MarkdownTableMerge[] = []
  for (const m of merges) {
    if (colIndex < m.startCol) {
      next.push({ ...m, startCol: m.startCol - 1, endCol: m.endCol - 1 })
    } else if (colIndex > m.endCol) {
      next.push(m)
    } else {
      // Column is within the merge
      const newEnd = m.endCol - 1
      if (newEnd >= m.startCol && (newEnd > m.startCol || m.endRow > m.startRow)) {
        next.push({ ...m, endCol: newEnd })
      }
    }
  }
  return next
}
