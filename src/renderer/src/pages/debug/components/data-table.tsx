import type { CSSProperties, ReactNode, Key } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  id: string
  label: ReactNode
  secondaryLabel?: ReactNode
  badge?: ReactNode
  description?: string
  /** 固定列必须配置宽度；多个固定列会累计偏移。 */
  pin?: "left"
  width?: number
  renderCell: (row: T) => ReactNode
}
export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[]
  rows: readonly T[]
  getRowKey: (row: T, index: number) => Key
  loading?: boolean
  error?: string
  emptyMessage?: ReactNode
  isRowHighlighted?: (row: T) => boolean
  stickyHeader?: boolean
  className?: string
}

export function DataTable<T>({ columns, rows, getRowKey, loading = false, error, emptyMessage = "暂无数据", isRowHighlighted, stickyHeader = true, className }: DataTableProps<T>) {
  const ordered = [...columns.filter((col) => col.pin === "left"), ...columns.filter((col) => col.pin !== "left")]
  let left = 0
  const styles = new Map<string, CSSProperties>()
  for (const col of ordered) {
    if (col.pin === "left") {
      const width = col.width ?? 280
      styles.set(col.id, { left, width, minWidth: width, maxWidth: width })
      left += width
    } else if (col.width) styles.set(col.id, { width: col.width, minWidth: col.width })
  }
  const message = error || (loading ? "正在加载数据…" : emptyMessage)
  return (
    <div
      aria-busy={loading}
      className={cn("min-h-0 flex-1 [&>div]:h-full", className)}
    >
      <Table>
        <TableHeader className={cn("bg-[#faf9f7]", stickyHeader && "sticky top-0 z-10")}>
          <TableRow className="border-[#f0efed] hover:bg-transparent">
            {ordered.map((col) => (
              <TableHead
                key={col.id}
                title={col.description}
                style={styles.get(col.id)}
                className={cn("whitespace-nowrap px-3 py-2 text-stone-600", col.pin && "sticky z-20 border-r border-stone-200 bg-[#faf9f7]")}
              >
                <span className="flex items-center gap-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-semibold">{col.label}</span>
                    {col.secondaryLabel && <span className="font-mono text-[10px] font-normal text-stone-400">{col.secondaryLabel}</span>}
                  </span>
                  {col.badge && <span className="shrink-0 rounded bg-stone-200/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-stone-400">{col.badge}</span>}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading || error || !rows.length ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={Math.max(1, columns.length)}
                className="py-16 text-center text-[13px] italic text-stone-400"
              >
                <span role={error ? "alert" : "status"}>{message}</span>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => {
              const highlighted = isRowHighlighted?.(row) ?? false
              return (
                <TableRow
                  key={getRowKey(row, index)}
                  className={cn("group border-[#f5f5f4]", highlighted ? "bg-amber-50 hover:bg-amber-100/70" : "hover:bg-[#faf9f7]/70")}
                >
                  {ordered.map((col) => (
                    <TableCell
                      key={col.id}
                      style={styles.get(col.id)}
                      className={cn("whitespace-nowrap px-3 py-2", col.pin && "sticky z-[1] border-r border-stone-200", col.pin && (highlighted ? "bg-amber-50 group-hover:bg-amber-100" : "bg-white group-hover:bg-[#faf9f7]"))}
                    >
                      <div className={col.pin ? "whitespace-normal break-all" : undefined}>{col.renderCell(row)}</div>
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
