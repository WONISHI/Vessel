import { useEffect, useState } from "react"
import { Database, Table2, Rows3, Columns3, Download, RefreshCw, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Column {
  key: string
  type: string
  primaryKey: number
}
interface TableMeta {
  name: string
  comment: string
  rowCount: number
  columnCount: number
  columns: Column[]
}

function displayType(name: string, type: string): string {
  if (/BOOL/i.test(type) || (/^(is_|has_)/.test(name) && /INT/i.test(type))) return "BOOLEAN"
  if (/DATE|TIME/i.test(type) || (/_at$/.test(name) && /TEXT/i.test(type))) return "DATETIME"
  return type.toUpperCase() || "ANY"
}

/** role 值 → 徽章配色 */
const ROLE_STYLE: Record<string, string> = {
  admin: "bg-green-50 text-green-700",
  user: "bg-blue-50 text-blue-700",
  pending: "bg-amber-50 text-amber-700",
  inactive: "bg-stone-100 text-stone-500"
}

const PAGE_SIZE = 50

/* ============================================================
 * 小部件
 * ========================================================== */

function MetaBadge({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e5e4] bg-white px-2.5 py-1 text-[12px] font-medium text-stone-500">
      <Icon className="h-3.5 w-3.5 text-stone-400" />
      {text}
    </span>
  )
}

/** 单元格按列类型/列名着色 */
function Cell({ col, value }: { col: Column; value: unknown }) {
  if (value === null || value === undefined) return <span className="font-mono italic text-stone-300">NULL</span>
  const text = value instanceof Uint8Array ? `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")}` : typeof value === "object" ? JSON.stringify(value) : String(value)
  if (col.primaryKey > 0)
    return (
      <span
        title="主键"
        className="inline-block rounded-full bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700"
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
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-[12.5px]", on ? "text-green-600" : "text-stone-400")}>
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
        className="whitespace-nowrap font-mono text-[12.5px] text-purple-600"
      >
        {formatted}
      </span>
    )
  }
  if (typeof value === "number" || /INT|REAL|FLOAT|DOUBLE|NUMERIC|DECIMAL/.test(col.type)) return <span className="font-mono text-[12.5px] text-blue-600">{text}</span>
  // 普通文本
  return <span className="font-mono text-[12.5px] text-stone-700">{text}</span>
}

/** 生成分页页码序列：1 2 3 ... 125 */
function getPageItems(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items: (number | "...")[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) items.push("...")
  for (let i = left; i <= right; i++) items.push(i)
  if (right < total - 1) items.push("...")
  items.push(total)
  return items
}

/* ============================================================
 * 数据存储页面
 * ========================================================== */

export default function StoragePage() {
  const [tables, setTables] = useState<TableMeta[]>([])
  const [activeName, setActiveName] = useState("")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [spinning, setSpinning] = useState(true)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ name: string; page: number; rows: Record<string, unknown>[]; total: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    setError("")
    window.electronAPI
      .listStorageTables()
      .then((items) => {
        if (cancelled) return
        setTables(items.map((item) => ({ ...item, comment: "本地 SQLite 数据 · 只读", columnCount: item.columns.length, columns: item.columns.map((col) => ({ key: col.name, type: displayType(col.name, col.type), primaryKey: col.primaryKey })) })))
        setActiveName((name) => (items.some((item) => item.name === name) ? name : (items[0]?.name ?? "")))
        if (!items.length) setSpinning(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err))
          setSpinning(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  useEffect(() => {
    if (!activeName) return
    let cancelled = false
    setSpinning(true)
    setError("")
    setResult(null)
    window.electronAPI
      .readStorageTable(activeName, page)
      .then((data) => {
        if (cancelled) return
        setResult({ name: activeName, ...data })
        setPage(data.page)
        setTables((items) => items.map((item) => (item.name === activeName ? { ...item, rowCount: data.total } : item)))
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setSpinning(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeName, page, revision])

  const table = tables.find((item) => item.name === activeName) ?? { name: "暂无数据表", comment: "", rowCount: 0, columnCount: 0, columns: [] }
  const totalPages = Math.max(1, Math.ceil(table.rowCount / PAGE_SIZE))
  const pageItems = getPageItems(page, totalPages)
  const shownRows = result?.name === activeName && result.page === page ? result.rows : []
  const rangeStart = shownRows.length ? (page - 1) * PAGE_SIZE + 1 : 0
  const rangeEnd = shownRows.length ? rangeStart + shownRows.length - 1 : 0
  const switchTable = (name: string) => {
    setActiveName(name)
    setPage(1)
  }
  const handleRefresh = () => {
    setSpinning(true)
    setRevision((value) => value + 1)
  }
  const handleExport = () => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const csv = [table.columns.map((col) => escape(col.key)).join(","), ...shownRows.map((row) => table.columns.map((col) => escape(row[col.key])).join(","))].join("\r\n")
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${table.name}-page-${page}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success("当前页已导出")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#faf9f7]">
      {/* 页面标题（高度固定 60px，参考 main-header） */}
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#f0efed] bg-white px-4">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[16px] font-bold text-stone-900">数据存储</h2>
          <span className="text-[12px] text-stone-400">SQLite 数据库表查看</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e7e5e4] bg-white px-3 py-1 text-[12px] font-semibold text-stone-500">
          <Database className="h-3.5 w-3.5" />
          {tables.length} 张表
        </span>
      </div>

      {/* 主体：左表列表 + 右数据 */}
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* 左侧数据表列表 */}
        <aside className="w-[224px] shrink-0 overflow-y-auto rounded-xl border border-[#e7e5e4] bg-white p-2 [scrollbar-width:thin]">
          <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
            <span className="text-[12px] font-semibold text-stone-400">数据表</span>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-200/70 px-1.5 text-[11px] font-semibold text-stone-500">{tables.length}</span>
          </div>
          <div className="space-y-0.5">
            {tables.map((t) => {
              const active = t.name === table.name
              return (
                <button
                  key={t.name}
                  onClick={() => switchTable(t.name)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors", active ? "bg-green-50" : "hover:bg-black/[0.03]")}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-green-100 text-green-600" : "bg-stone-100 text-stone-400")}>
                    <Table2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block truncate text-[13.5px] font-bold", active ? "text-green-700" : "text-stone-800")}>{t.name}</span>
                    <span className="block truncate text-[11.5px] text-stone-400">
                      {t.rowCount.toLocaleString()}行 · {t.columnCount}列
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* 右侧数据卡片 */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
          {/* 表信息栏 */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#f0efed] px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600">
                <Table2 className="h-[18px] w-[18px]" />
              </span>
              <div>
                <div className="text-[16px] font-bold leading-tight text-stone-900">{table.name}</div>
                <div className="text-[12px] leading-tight text-stone-400">{table.comment}</div>
              </div>
              <div className="ml-2 flex items-center gap-2">
                <MetaBadge
                  icon={Rows3}
                  text={`${table.rowCount.toLocaleString()} 行`}
                />
                <MetaBadge
                  icon={Columns3}
                  text={`${table.columnCount} 列`}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-[12.5px]"
                disabled={spinning || !shownRows.length}
                onClick={handleExport}
              >
                <Download className="h-3.5 w-3.5" />
                导出当前页
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-[12.5px]"
                disabled={spinning}
                onClick={handleRefresh}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
                刷新
              </Button>
            </div>
          </div>

          {/* 表格（shadcn Table，只读） */}
          <div className="min-h-0 flex-1 [&>div]:h-full">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-[#faf9f7]">
                <TableRow className="border-[#f0efed] hover:bg-transparent">
                  {table.columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className="whitespace-nowrap px-5 py-3 text-[13px] font-bold text-stone-600"
                    >
                      <span className="inline-flex items-center gap-2">
                        {col.key}
                        <span className="rounded bg-stone-200/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-stone-400">{col.type}</span>
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownRows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={Math.max(1, table.columns.length)}
                      className="py-16 text-center text-[13px] italic text-stone-400"
                    >
                      {error || (spinning ? "正在加载数据…" : activeName ? "该表暂无数据" : "暂无数据表")}
                    </TableCell>
                  </TableRow>
                )}
                {shownRows.map((row, i) => (
                  <TableRow
                    key={i}
                    className="border-[#f5f5f4] hover:bg-[#faf9f7]/70"
                  >
                    {table.columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className="whitespace-nowrap px-5 py-3"
                      >
                        <Cell
                          col={col}
                          value={row[col.key]}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          <div className="flex shrink-0 items-center justify-between border-t border-[#f0efed] px-5 py-3">
            <span className="text-[12.5px] text-stone-500">
              显示 {rangeStart}-{rangeEnd} 条，共 {table.rowCount.toLocaleString()} 条
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={spinning || page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pageItems.map((item, idx) =>
                item === "..." ? (
                  <span
                    key={`e${idx}`}
                    className="px-1.5 text-[12.5px] text-stone-400"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    disabled={spinning}
                    onClick={() => setPage(item)}
                    className={cn("h-8 min-w-8 rounded-lg px-2 text-[12.5px] font-medium transition-colors", item === page ? "bg-green-600 font-semibold text-white" : "border border-[#e7e5e4] bg-white text-stone-600 hover:bg-[#faf9f7]")}
                  >
                    {item}
                  </button>
                )
              )}
              <Button
                variant="outline"
                size="icon"
                disabled={spinning || page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
