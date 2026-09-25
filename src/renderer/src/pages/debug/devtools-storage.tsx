import { useMemo, useState } from "react"
import { Database, Table2, Rows3, Columns3, Download, RefreshCw, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

/* ============================================================
 * 类型 & 模拟数据
 * ========================================================== */

type ColumnType = "INTEGER" | "TEXT" | "BOOLEAN" | "DATETIME" | "REAL"

interface Column {
  key: string
  type: ColumnType
}

type RowData = Record<string, string | number | boolean>

interface TableMeta {
  name: string
  comment: string
  rowCount: number
  /** 显示用列数（columns 仅渲染代表性列，可少于该值） */
  columnCount: number
  columns: Column[]
  rows: RowData[]
}

const TABLES: TableMeta[] = [
  {
    name: "users",
    comment: "用户表 · 存储所有用户信息",
    rowCount: 1248,
    columnCount: 7,
    columns: [
      { key: "id", type: "INTEGER" },
      { key: "username", type: "TEXT" },
      { key: "email", type: "TEXT" },
      { key: "role", type: "TEXT" },
      { key: "age", type: "INTEGER" },
      { key: "is_active", type: "BOOLEAN" },
      { key: "created_at", type: "DATETIME" }
    ],
    rows: [
      { id: 1, username: "alice_wonder", email: "alice@example.com", role: "admin", age: 28, is_active: true, created_at: "2024-01-15 09:30:00" },
      { id: 2, username: "bob_builder", email: "bob@example.com", role: "user", age: 35, is_active: true, created_at: "2024-01-16 14:20:00" },
      { id: 3, username: "charlie_dev", email: "charlie@example.com", role: "user", age: 42, is_active: false, created_at: "2024-01-17 08:45:00" },
      { id: 4, username: "diana_design", email: "diana@example.com", role: "admin", age: 31, is_active: true, created_at: "2024-01-18 16:10:00" },
      { id: 5, username: "eve_editor", email: "eve@example.com", role: "pending", age: 26, is_active: false, created_at: "2024-01-19 11:25:00" },
      { id: 6, username: "frank_fullstack", email: "frank@example.com", role: "user", age: 38, is_active: true, created_at: "2024-01-20 09:00:00" },
      { id: 7, username: "grace_qa", email: "grace@example.com", role: "inactive", age: 29, is_active: false, created_at: "2024-01-21 13:45:00" },
      { id: 8, username: "henry_ops", email: "henry@example.com", role: "user", age: 45, is_active: true, created_at: "2024-01-22 17:30:00" }
    ]
  },
  {
    name: "notes",
    comment: "笔记表 · 存储笔记内容",
    rowCount: 3567,
    columnCount: 12,
    columns: [
      { key: "id", type: "INTEGER" },
      { key: "workspace_id", type: "INTEGER" },
      { key: "title", type: "TEXT" },
      { key: "type", type: "TEXT" },
      { key: "word_count", type: "INTEGER" },
      { key: "updated_at", type: "DATETIME" }
    ],
    rows: []
  },
  {
    name: "workspaces",
    comment: "工作区表 · 存储工作区配置",
    rowCount: 24,
    columnCount: 6,
    columns: [
      { key: "id", type: "INTEGER" },
      { key: "name", type: "TEXT" },
      { key: "path", type: "TEXT" },
      { key: "last_opened", type: "DATETIME" }
    ],
    rows: []
  },
  {
    name: "tags",
    comment: "标签表 · 存储标签定义",
    rowCount: 156,
    columnCount: 4,
    columns: [
      { key: "id", type: "INTEGER" },
      { key: "name", type: "TEXT" },
      { key: "color", type: "TEXT" },
      { key: "count", type: "INTEGER" }
    ],
    rows: []
  },
  {
    name: "history",
    comment: "历史记录表 · 存储操作历史",
    rowCount: 8932,
    columnCount: 7,
    columns: [
      { key: "id", type: "INTEGER" },
      { key: "note_id", type: "INTEGER" },
      { key: "action", type: "TEXT" },
      { key: "timestamp", type: "DATETIME" }
    ],
    rows: []
  },
  {
    name: "settings",
    comment: "设置表 · 存储应用配置",
    rowCount: 1,
    columnCount: 15,
    columns: [
      { key: "id", type: "INTEGER" },
      { key: "key", type: "TEXT" },
      { key: "value", type: "TEXT" },
      { key: "type", type: "TEXT" }
    ],
    rows: []
  },
  {
    name: "attachments",
    comment: "附件表 · 存储附件元数据",
    rowCount: 432,
    columnCount: 9,
    columns: [
      { key: "id", type: "INTEGER" },
      { key: "note_id", type: "INTEGER" },
      { key: "filename", type: "TEXT" },
      { key: "size", type: "INTEGER" },
      { key: "created_at", type: "DATETIME" }
    ],
    rows: []
  },
  {
    name: "sessions",
    comment: "会话表 · 存储会话状态",
    rowCount: 128,
    columnCount: 5,
    columns: [
      { key: "id", type: "INTEGER" },
      { key: "token", type: "TEXT" },
      { key: "device", type: "TEXT" },
      { key: "created_at", type: "DATETIME" }
    ],
    rows: []
  }
]

/** role 值 → 徽章配色 */
const ROLE_STYLE: Record<string, string> = {
  admin: "bg-green-50 text-green-700",
  user: "bg-blue-50 text-blue-700",
  pending: "bg-amber-50 text-amber-700",
  inactive: "bg-stone-100 text-stone-500"
}

const PAGE_SIZE = 10 // 用于计算总页数（1248 条 → 125 页）

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
function Cell({ col, value }: { col: Column; value: string | number | boolean }) {
  // role 用彩色徽章
  if (col.key === "role") {
    const v = String(value)
    return <span className={cn("inline-block rounded-md px-2 py-0.5 text-[12px] font-semibold", ROLE_STYLE[v] ?? "bg-stone-100 text-stone-600")}>{v}</span>
  }
  // 布尔值：圆点 + true/false
  if (col.type === "BOOLEAN") {
    const on = value === true
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-[12.5px]", on ? "text-green-600" : "text-stone-400")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-green-500" : "bg-stone-300")} />
        {on ? "true" : "false"}
      </span>
    )
  }
  // 主键 id 绿色
  if (col.key === "id") return <span className="font-mono text-[12.5px] font-semibold text-green-600">{value}</span>
  // 时间紫色
  if (col.type === "DATETIME") return <span className="whitespace-nowrap font-mono text-[12.5px] text-purple-600">{value}</span>
  // 其他整数蓝色
  if (col.type === "INTEGER") return <span className="font-mono text-[12.5px] text-blue-600">{value}</span>
  // 普通文本
  return <span className="font-mono text-[12.5px] text-stone-700">{value}</span>
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
  const [activeName, setActiveName] = useState(TABLES[0].name)
  const [page, setPage] = useState(1)
  const [spinning, setSpinning] = useState(false)

  const table = useMemo(() => TABLES.find((t) => t.name === activeName) ?? TABLES[0], [activeName])
  const totalPages = Math.max(1, Math.ceil(table.rowCount / PAGE_SIZE))
  const pageItems = getPageItems(page, totalPages)
  const shownRows = table.rows
  const rangeStart = (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(rangeStart + shownRows.length - 1, table.rowCount)

  const switchTable = (name: string) => {
    setActiveName(name)
    setPage(1)
  }

  const handleRefresh = () => {
    setSpinning(true)
    setTimeout(() => {
      setSpinning(false)
      toast.success("数据已刷新")
    }, 600)
  }

  const handleExport = () => toast.success(`正在导出 ${table.name}.csv ...`)

  return (
    <div className="flex h-full flex-col bg-[#faf9f7]">
      {/* 页面标题（高度固定 60px，参考 main-header） */}
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#f0efed] bg-white px-4">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[16px] font-bold text-stone-900">数据存储</h2>
          <span className="text-[12px] text-stone-400">SQLite 数据库表查看</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e7e5e4] bg-white px-3 py-1 text-[12px] font-semibold text-stone-500">
          <Database className="h-3.5 w-3.5" />
          {TABLES.length} 张表
        </span>
      </div>

      {/* 主体：左表列表 + 右数据 */}
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* 左侧数据表列表 */}
        <aside className="w-[224px] shrink-0 overflow-y-auto rounded-xl border border-[#e7e5e4] bg-white p-2 [scrollbar-width:thin]">
          <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
            <span className="text-[12px] font-semibold text-stone-400">数据表</span>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-200/70 px-1.5 text-[11px] font-semibold text-stone-500">{TABLES.length}</span>
          </div>
          <div className="space-y-0.5">
            {TABLES.map((t) => {
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
                onClick={handleExport}
              >
                <Download className="h-3.5 w-3.5" />
                导出
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-[12.5px]"
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
                      colSpan={table.columns.length}
                      className="py-16 text-center text-[13px] italic text-stone-400"
                    >
                      该表为示例数据，暂未加载预览行（只读查看器，不提供编辑）
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
                disabled={page === 1}
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
                    onClick={() => setPage(item)}
                    className={cn(
                      "h-8 min-w-8 rounded-lg px-2 text-[12.5px] font-medium transition-colors",
                      item === page ? "bg-green-600 font-semibold text-white" : "border border-[#e7e5e4] bg-white text-stone-600 hover:bg-[#faf9f7]"
                    )}
                  >
                    {item}
                  </button>
                )
              )}
              <Button
                variant="outline"
                size="icon"
                disabled={page === totalPages}
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
