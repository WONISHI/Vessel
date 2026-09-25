import { cn } from "@/lib/utils"
export interface StorageColumn {
  key: string
  type: string
  primaryKey: number
}
type Column = StorageColumn
/** role 值 → 徽章配色 */
const ROLE_STYLE: Record<string, string> = {
  admin: "bg-green-50 text-green-700",
  user: "bg-blue-50 text-blue-700",
  pending: "bg-amber-50 text-amber-700",
  inactive: "bg-stone-100 text-stone-500"
}

/** 单元格按列类型/列名着色 */
export function StorageCell({ col, value }: { col: Column; value: unknown }) {
  if (value === null || value === undefined) return <span className="font-mono italic text-stone-300">NULL</span>
  const text = value instanceof Uint8Array ? `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")}` : typeof value === "object" ? JSON.stringify(value) : String(value)
  if (col.primaryKey > 0)
    return (
      <span
        title="主键"
        className="inline-block rounded-full bg-green-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-green-700"
      >
        {text}
      </span>
    )
  // role 用彩色徽章
  if (col.key === "role") {
    const v = String(value)
    return <span className={cn("inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold", ROLE_STYLE[v] ?? "bg-stone-100 text-stone-600")}>{v}</span>
  }
  // 布尔值：圆点 + true/false
  if (col.type === "BOOLEAN") {
    const on = value === true || value === 1 || value === "1" || value === "true"
    if (!on && value !== false && value !== 0 && value !== "0" && value !== "false") return <span>{text}</span>
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-[11px]", on ? "text-green-600" : "text-stone-400")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-green-500" : "bg-stone-300")} />
        {on ? "true" : "false"}
      </span>
    )
  }
  if (col.type === "DATETIME") {
    const formatted = text.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/, "$1 $2")
    return (
      <span
        title={text}
        className="whitespace-nowrap font-mono text-[11px] text-purple-600"
      >
        {formatted}
      </span>
    )
  }
  if (typeof value === "number" || /INT|REAL|FLOAT|DOUBLE|NUMERIC|DECIMAL/.test(col.type)) return <span className="font-mono text-[11px] text-blue-600">{text}</span>
  // 普通文本
  return <span className="font-mono text-[11px] text-stone-700">{text}</span>
}
