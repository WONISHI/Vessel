export interface MarkdownTableCellStyle {
  bgColor?: string
  textColor?: string
  bold?: boolean
  italic?: boolean
  align?: "left" | "center" | "right"
}

export interface MarkdownTableCell {
  id: string
  text: string
  style?: MarkdownTableCellStyle
}

export interface MarkdownTableRow {
  isHeader?: boolean
  cells: MarkdownTableCell[]
}

export interface MarkdownTableColumn {
  width?: number
  align?: "left" | "center" | "right"
}

export interface MarkdownTableMerge {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface MarkdownTableData {
  version?: number
  caption?: string
  columns: MarkdownTableColumn[]
  rows: MarkdownTableRow[]
  merges: MarkdownTableMerge[]
}

export interface TableCoord {
  row: number
  col: number
}

export interface TableRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}
