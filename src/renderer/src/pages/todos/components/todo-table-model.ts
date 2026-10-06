export type ColumnTypeKey = "text" | "person" | "tag" | "time" | "status" | "progress" | "action"

export interface ColumnDef {
  id: string
  type: ColumnTypeKey
  title: string
}

export interface TableRowData {
  id: string
  title: string
  completed: boolean
  person?: { name: string; avatarColor?: string }
  tags?: { id: string; label: string; colorClass?: string }[]
  time?: string
  status?: { key: string; label: string; colorClass?: string }
  progress?: { value: number; colorClass?: string }
}

export interface TodoTab {
  id: string
  title: string
  columns: ColumnDef[]
  rows: TableRowData[]
}

export const greenInput = "todo-green-input"
export function formatTodoDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
export function parseTodoDate(value?: string) {
  const match = value?.match(/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日$/)
  return match ? new Date(Number(match[1] || new Date().getFullYear()), Number(match[2]) - 1, Number(match[3])) : new Date()
}
export const COLOR_PRESETS = [
  { name: "蓝色", class: "bg-blue-50 text-blue-600 border-blue-200" },
  { name: "绿色", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { name: "紫色", class: "bg-purple-50 text-purple-600 border-purple-200" },
  { name: "红色", class: "bg-red-50 text-red-600 border-red-200" },
  { name: "橙色", class: "bg-amber-50 text-amber-700 border-amber-200" },
  { name: "灰色", class: "bg-stone-100 text-stone-600 border-stone-200" }
]

export const STATUS_OPTIONS = [
  { key: "doing", label: "进行中", colorClass: "bg-blue-50 text-blue-600 border-blue-200", dotClass: "bg-blue-600" },
  { key: "done", label: "已完成", colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-600" },
  { key: "pending", label: "待开始", colorClass: "bg-stone-100 text-stone-600 border-stone-200", dotClass: "bg-stone-400" },
  { key: "overdue", label: "已逾期", colorClass: "bg-red-50 text-red-600 border-red-200", dotClass: "bg-red-600" }
]
