import { type StorageColumn } from "@/pages/debug/storage/components/storage-cell"
export interface TableMeta {
  name: string
  comment: string
  rowCount: number
  columnCount: number
  columns: StorageColumn[]
}

/** Performs the display type operation. */
export function displayType(name: string, type: string): string {
  if (/BOOL/i.test(type) || (/^(is_|has_)/.test(name) && /INT/i.test(type))) return "BOOLEAN"
  if (/DATE|TIME/i.test(type) || (/_at$/.test(name) && /TEXT/i.test(type))) return "DATETIME"
  return type.toUpperCase() || "ANY"
}
