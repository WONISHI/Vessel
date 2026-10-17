export type BaseValue = null | string | number | boolean | BaseValue[] | { [key: string]: BaseValue }
export type BaseFilter = string | { and?: BaseFilter[]; or?: BaseFilter[]; not?: BaseFilter[] }
export interface BaseView {
  type: string
  name: string
  filters?: BaseFilter
  order?: string[]
  sort?: { property: string; direction: "ASC" | "DESC" }[]
  limit?: number
  groupBy?: { property: string; direction?: "ASC" | "DESC" }
}
export interface BaseDocument {
  filters?: BaseFilter
  formulas: Record<string, string>
  properties: Record<string, { displayName?: string }>
  views: BaseView[]
  warnings: string[]
}
export interface BaseFile {
  path: string
  properties: Record<string, BaseValue>
  file: { name: string; path: string; folder: string; ext: string; size: number; ctime: number; mtime: number; tags: string[]; links: string[]; properties: Record<string, BaseValue> }
}
export interface BaseQueryResult {
  viewIndex: number
  views: { name: string; type: string }[]
  columns: { key: string; label: string }[]
  rows: { path: string; values: Record<string, BaseValue>; group?: BaseValue }[]
  warnings: string[]
}
