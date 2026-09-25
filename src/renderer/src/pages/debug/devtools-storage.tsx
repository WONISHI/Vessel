import { useEffect, useState } from "react"
import { Database, Table2, Rows3, Columns3, Download, RefreshCw, type LucideIcon } from "lucide-react"
import { DataTable, type DataTableColumn } from "./components/data-table"
import { DataTablePagination } from "./components/data-table-pagination"
import { StorageCell, type StorageColumn } from "./storage-cell"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getTableLabel, getTableDescription, getFieldLabel, getFieldDescription } from "./storage-labels"

interface TableMeta {
  name: string
  comment: string
  rowCount: number
  columnCount: number
  columns: StorageColumn[]
}

function displayType(name: string, type: string): string {
  if (/BOOL/i.test(type) || (/^(is_|has_)/.test(name) && /INT/i.test(type))) return "BOOLEAN"
  if (/DATE|TIME/i.test(type) || (/_at$/.test(name) && /TEXT/i.test(type))) return "DATETIME"
  return type.toUpperCase() || "ANY"
}

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

/* ============================================================
 * 数据存储页面
 * ========================================================== */

export default function StoragePage() {
  const [tables, setTables] = useState<TableMeta[]>([])
  const [activeName, setActiveName] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [keyword, setKeyword] = useState("")
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
        setTables(items.map((item) => ({ ...item, comment: getTableDescription(item.name), columnCount: item.columns.length, columns: item.columns.map((col) => ({ key: col.name, type: displayType(col.name, col.type), primaryKey: col.primaryKey })) })))
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
      .readStorageTable(activeName, page, keyword, pageSize)
      .then((data) => {
        if (cancelled) return
        setResult({ name: activeName, ...data })
        setPage(data.page)
        if (!keyword) setTables((items) => items.map((item) => (item.name === activeName ? { ...item, rowCount: data.total } : item)))
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
  }, [activeName, page, revision, keyword, pageSize])

  const table = tables.find((item) => item.name === activeName) ?? { name: "暂无数据表", comment: "", rowCount: 0, columnCount: 0, columns: [] }
  const columns: DataTableColumn<Record<string, unknown>>[] = [...table.columns]
    .sort((a, b) => (a.primaryKey || Infinity) - (b.primaryKey || Infinity))
    .map((col) => ({
      id: col.key,
      label: getFieldLabel(table.name, col.key),
      secondaryLabel: `${col.key}${col.primaryKey > 0 ? " · 主键" : ""}`,
      badge: col.type,
      description: `${getFieldDescription(table.name, col.key)}${col.primaryKey > 0 ? "（主键）" : ""}`,
      pin: col.primaryKey > 0 ? "left" : undefined,
      width: col.primaryKey > 0 ? 280 : undefined,
      renderCell: (row) => (
        <StorageCell
          col={col}
          value={row[col.key]}
        />
      )
    }))
  const matchedTotal = result?.name === activeName ? result.total : 0
  const shownRows = result?.name === activeName && result.page === page ? result.rows : []
  const switchTable = (name: string) => {
    setActiveName(name)
    setKeyword("")
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
                <Button
                  variant="ghost"
                  aria-pressed={active}
                  key={t.name}
                  onClick={() => switchTable(t.name)}
                  title={`${t.name}：${getTableDescription(t.name)}`}
                  className={cn("flex h-auto w-full justify-start items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors", active ? "bg-green-50 hover:bg-green-50" : "hover:bg-black/[0.03]")}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-green-100 text-green-600" : "bg-stone-100 text-stone-400")}>
                    <Table2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className={cn("shrink-0 text-[11px] font-semibold", active ? "text-green-700" : "text-stone-800")}>{getTableLabel(t.name)}</span>
                      <span className="truncate font-mono text-[10px] text-stone-400">{t.name}</span>
                    </span>
                    <span className="block truncate text-[11.5px] text-stone-400">
                      {t.rowCount.toLocaleString()}行 · {t.columnCount}列
                    </span>
                  </span>
                </Button>
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
                <div className="text-[16px] font-bold leading-tight text-stone-900">
                  {getTableLabel(table.name)} <span className="ml-2 font-mono text-[12px] font-normal text-stone-400">{table.name}</span>
                </div>
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
                className="h-8 gap-1.5 rounded-lg text-[11px]"
                disabled={spinning || !shownRows.length}
                onClick={handleExport}
              >
                <Download className="h-3.5 w-3.5" />
                导出当前页
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-[11px]"
                disabled={spinning}
                onClick={handleRefresh}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
                刷新
              </Button>
              <Input
                type="search"
                aria-label="搜索当前表全部字段"
                placeholder="搜索关键词…"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                }}
                className="h-8 w-40 rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] md:text-[11px] focus-visible:border-green-500 focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            rows={shownRows}
            loading={spinning}
            error={error}
            emptyMessage={activeName ? (keyword ? "没有匹配的记录" : "该表暂无数据") : "暂无数据表"}
            isRowHighlighted={() => Boolean(keyword)}
            getRowKey={(row, index) => {
              const keys = table.columns.filter((col) => col.primaryKey > 0)
              return keys.length ? JSON.stringify(keys.map((col) => row[col.key])) : `${page}-${index}`
            }}
          />

          {/* 分页 */}
          <DataTablePagination
            key={activeName}
            page={page}
            pageSize={pageSize}
            total={matchedTotal}
            visibleRowCount={shownRows.length}
            loading={spinning}
            filtered={Boolean(keyword)}
            onPaginationChange={({ page, pageSize }) => {
              setPage(page)
              setPageSize(pageSize)
            }}
          />
        </section>
      </div>
    </div>
  )
}
