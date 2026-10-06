import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type SetStateAction } from "react"
import {
  Type,
  User,
  Tag as TagIcon,
  Calendar as CalendarIcon,
  CheckCircle2,
  Activity,
  MoreVertical,
  Plus,
  X,
  Copy,
  Trash2,
  Pencil,
  ClipboardList,
  Check,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from "@/components/ui/popover"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import "./todo-table-section.css"
import { dateKey, monthDays } from "../calendar"

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

const COLUMN_TYPES_META: Record<
  ColumnTypeKey,
  { label: string; desc: string; icon: typeof Type; defaultWidth: string }
> = {
  text: { label: "文本属性", desc: "普通文字内容", icon: Type, defaultWidth: "26%" },
  person: { label: "人物属性", desc: "负责人 / 成员", icon: User, defaultWidth: "14%" },
  tag: { label: "Tag 属性", desc: "标签 / 分类", icon: TagIcon, defaultWidth: "14%" },
  time: { label: "时间属性", desc: "日期 / 截止时间", icon: CalendarIcon, defaultWidth: "170px" },
  status: { label: "状态属性", desc: "进行中 / 已完成等", icon: CheckCircle2, defaultWidth: "14%" },
  progress: { label: "进度属性", desc: "百分比进度条", icon: Activity, defaultWidth: "14%" },
  action: { label: "操作属性", desc: "编辑 / 删除按钮", icon: MoreVertical, defaultWidth: "10%" }
}

const greenInput = "todo-green-input"
function formatTodoDate(date: Date) { return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` }
function parseTodoDate(value?: string) {
  const match = value?.match(/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日$/)
  return match ? new Date(Number(match[1] || new Date().getFullYear()), Number(match[2]) - 1, Number(match[3])) : new Date()
}
function EditableColumnTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(title)
  const save = () => { if (draft.trim()) onRename(draft.trim()); setEditing(false) }
  return editing ? <Input autoFocus aria-label="列标题" value={draft} onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }} className={cn(greenInput, "h-7 min-w-0 text-xs")} /> : <span title="双击修改列标题" onDoubleClick={() => { setDraft(title); setEditing(true) }} className="cursor-text">{title}</span>
}
const COLOR_PRESETS = [
  { name: "蓝色", class: "bg-blue-50 text-blue-600 border-blue-200" },
  { name: "绿色", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { name: "紫色", class: "bg-purple-50 text-purple-600 border-purple-200" },
  { name: "红色", class: "bg-red-50 text-red-600 border-red-200" },
  { name: "橙色", class: "bg-amber-50 text-amber-700 border-amber-200" },
  { name: "灰色", class: "bg-stone-100 text-stone-600 border-stone-200" }
]

const STATUS_OPTIONS = [
  { key: "doing", label: "进行中", colorClass: "bg-blue-50 text-blue-600 border-blue-200", dotClass: "bg-blue-600" },
  { key: "done", label: "已完成", colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-600" },
  { key: "pending", label: "待开始", colorClass: "bg-stone-100 text-stone-600 border-stone-200", dotClass: "bg-stone-400" },
  { key: "overdue", label: "已逾期", colorClass: "bg-red-50 text-red-600 border-red-200", dotClass: "bg-red-600" }
]

export default function TodoTableSection() {
  const [tabs, updateTabs] = useState<TodoTab[]>(() => {
    return [
    {
      id: "tab_1",
      title: "新建待办事项",
      columns: [
        { id: "col_title", type: "text", title: "标题" },
        { id: "col_tag", type: "tag", title: "Tag" },
        { id: "col_progress", type: "progress", title: "进度" },
        { id: "col_time", type: "time", title: "时间" },
        { id: "col_status", type: "status", title: "状态" },
        { id: "col_action", type: "action", title: "操作" }
      ],
      rows: [
        {
          id: "row_1",
          title: "新建待办事项",
          completed: false,
          person: undefined,
          tags: [],
          time: formatTodoDate(new Date()),
          status: { key: "doing", label: "进行中", colorClass: "bg-blue-50 text-blue-600 border-blue-200" },
          progress: { value: 71, colorClass: "bg-green-600" }
        }
      ]
    }
  ]
  })
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id)
  const [storageError, setStorageError] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const latestTabs = useRef(tabs)
  const writes = useRef(Promise.resolve())
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const saved = await window.electronAPI.getAppState<TodoTab[]>("todo-tables-v1")
        let next = saved
        if (saved === null) {
          const legacy = localStorage.getItem("vessel-todo-tables-v1")
          next = legacy ? JSON.parse(legacy) : latestTabs.current
        }
        if (!Array.isArray(next) || !next.length || !next.every(tab => typeof tab.id === "string" && typeof tab.title === "string" && Array.isArray(tab.rows) && Array.isArray(tab.columns) && tab.columns.every(col => col.type in COLUMN_TYPES_META))) throw new Error("待办数据格式无效")
        if (cancelled) return
        // SQLite is authoritative. Remove the old copy only after a successful commit.
        if (saved === null) await window.electronAPI.setAppState("todo-tables-v1", next)
        if (cancelled) return
        localStorage.removeItem("vessel-todo-tables-v1")
        latestTabs.current = next
        updateTabs(next)
        setActiveTabId(next[0].id)
        setStorageError("")
        setLoaded(true)
      } catch { if (!cancelled) setStorageError("无法读取或迁移待办数据，原数据已保留，请重试。") }
    }
    void load()
    return () => { cancelled = true }
  }, [loadAttempt])
  const setTabs = useCallback((change: SetStateAction<TodoTab[]>) => {
    if (!loaded) return
    const next = typeof change === "function" ? change(latestTabs.current) : change
    latestTabs.current = next
    updateTabs(next)
    // Serialize writes so fast edits cannot overwrite newer values with older ones.
    writes.current = writes.current.then(() => window.electronAPI.setAppState("todo-tables-v1", next))
      .then(() => setStorageError(""))
      .catch(() => setStorageError("无法保存到 SQLite，请检查磁盘空间后重试保存。"))
  }, [loaded])
  const [confirmation, setConfirmation] = useState<{ title: string; action: () => void } | null>(null)
  const confirmDelete = (title: string, action: () => void) => setConfirmation({ title, action })
  const [showAddColPopover, setShowAddColPopover] = useState(false)
  const [isRenamingTab, setIsRenamingTab] = useState(false)
  const [renameTabTitle, setRenameTabTitle] = useState("")

  // 控制单元格标题编辑状态
  const [editingRowId, setEditingRowId] = useState<string | null>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]

  // 新增 Tab
  const handleAddTab = () => {
    const newId = `tab_${crypto.randomUUID()}`
    const newTab: TodoTab = {
      id: newId,
      title: `新建待办事项`,
      columns: [
        { id: "col_title", type: "text", title: "标题" },
        { id: "col_tag", type: "tag", title: "Tag" },
        { id: "col_progress", type: "progress", title: "进度" },
        { id: "col_time", type: "time", title: "时间" },
        { id: "col_status", type: "status", title: "状态" },
        { id: "col_action", type: "action", title: "操作" }
      ],
      rows: [
        {
          id: `row_${crypto.randomUUID()}`,
          title: "",
          completed: false,
          person: undefined,
          tags: [],
          time: formatTodoDate(new Date()),
          status: { key: "doing", label: "进行中", colorClass: "bg-blue-50 text-blue-600 border-blue-200" },
          progress: { value: 0, colorClass: "bg-green-600" }
        }
      ]
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newId)
  }

  // 删除 Tab
  const handleDeleteTab = (tabId: string) => {
    if (tabs.length <= 1) {
      setStorageError("至少保留一个待办表格 Tab")
      return
    }
    const nextTabs = tabs.filter((t) => t.id !== tabId)
    setTabs(nextTabs)
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[0].id)
    }
  }

  // 重命名当前 Tab
  const handleSaveTabRename = () => {
    if (!activeTab) return
    const trimmed = renameTabTitle.trim() || "未命名待办"
    setTabs(
      tabs.map((t) => (t.id === activeTab.id ? { ...t, title: trimmed } : t))
    )
    setIsRenamingTab(false)

  }

  // 添加列
  const handleAddColumn = (type: ColumnTypeKey) => {
    if (!activeTab) return
    if (type === "action") return
    const typeMeta = COLUMN_TYPES_META[type]
    const newCol: ColumnDef = {
      id: `col_${crypto.randomUUID()}`,
      type,
      title: typeMeta.label.replace("属性", "")
    }
    const actionIdx = activeTab.columns.findIndex((c) => c.type === "action")
    const nextCols = [...activeTab.columns]
    if (actionIdx >= 0) {
      nextCols.splice(actionIdx, 0, newCol)
    } else {
      nextCols.push(newCol)
    }

    setTabs(
      tabs.map((t) => (t.id === activeTab.id ? { ...t, columns: nextCols } : t))
    )
    setShowAddColPopover(false)

  }

  // 删除列
  const handleRemoveColumn = (colId: string) => {
    if (!activeTab) return
    if (activeTab.columns.length <= 1) {
      setStorageError("至少保留一列")
      return
    }
    setTabs(
      tabs.map((t) =>
        t.id === activeTab.id
          ? { ...t, columns: t.columns.filter((c) => c.id !== colId) }
          : t
      )
    )
  }

  // 新增行 (输入框没有默认值，添加后才有值)
  const handleAddRow = () => {
    if (!activeTab) return
    const newRowId = `row_${crypto.randomUUID()}`
    const newRow: TableRowData = {
      id: newRowId,
      title: "",
      completed: false,
      person: undefined,
      tags: [],
      time: formatTodoDate(new Date()),
      status: { key: "doing", label: "进行中", colorClass: "bg-blue-50 text-blue-600 border-blue-200" },
      progress: { value: 0, colorClass: activeTab.rows[0]?.progress?.colorClass || "bg-green-600" }
    }
    setTabs(
      tabs.map((t) =>
        t.id === activeTab.id ? { ...t, rows: [...t.rows, newRow] } : t
      )
    )
    setEditingRowId(newRowId)
  }

  // 删除行
  const handleDeleteRow = (rowId: string) => {
    if (!activeTab) return
    setTabs(
      tabs.map((t) =>
        t.id === activeTab.id
          ? { ...t, rows: t.rows.filter((r) => r.id !== rowId) }
          : t
      )
    )
  }

  // 更新行的某个属性
  const handleUpdateRow = (rowId: string, patch: Partial<TableRowData>) => {
    if (!activeTab) return
    setTabs(
      tabs.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              rows: t.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
            }
          : t
      )
    )
  }

  // 需求 2：修改某个进度条的颜色时，同步修改同表格下所有行属性的进度条颜色！
  const handleChangeAllProgressColor = (colorClass: string) => {
    if (!activeTab) return
    setTabs(
      tabs.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              rows: t.rows.map((r) => ({
                ...r,
                progress: {
                  value: r.progress?.value ?? 0,
                  colorClass
                }
              }))
            }
          : t
      )
    )

  }

  // 复制待办内容
  const handleCopyDetails = () => {
    if (!activeTab) return
    void navigator.clipboard.writeText(
      `待办名称：${activeTab.title}\n包含 ${activeTab.rows.length} 行数据，${activeTab.columns.length} 个属性列`
    )
    toast.success("已复制待办详情")
  }

  if (!loaded) return <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 text-sm" role={storageError ? "alert" : "status"}>{storageError || "正在加载待办表格…"}{storageError && <button className="ml-3 text-green-700" onClick={() => setLoadAttempt(value => value + 1)}>重试</button>}</div>
  return (
    <div className="todo-table-section mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <AlertDialog open={!!confirmation} onOpenChange={open => { if (!open) setConfirmation(null) }}>
        <AlertDialogContent className="todo-confirm-dialog" overlayClassName="!z-[230] !bg-black/45">
          <div className="todo-confirm-heading">
            <span className="todo-confirm-icon" aria-hidden="true"><Trash2 /></span>
            <AlertDialogHeader className="todo-confirm-text">
              <AlertDialogTitle className="todo-confirm-title">{confirmation?.title}</AlertDialogTitle>
              <AlertDialogDescription className="todo-confirm-description">删除后无法恢复，请确认是否继续。</AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="todo-confirm-actions">
            <AlertDialogCancel className="todo-confirm-cancel">取消</AlertDialogCancel>
            <AlertDialogAction className="todo-confirm-delete" onClick={() => { confirmation?.action(); setConfirmation(null) }}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {storageError && <p role="alert" className="px-4 py-2 text-xs text-red-600">{storageError}<button className="ml-2 underline" onClick={() => setTabs(latestTabs.current)}>重试保存</button></p>}
      {/* 1. Tab 栏 */}
      <div className="flex h-11 items-center gap-1 border-b border-stone-100 bg-[#faf9f7] px-3 overflow-x-auto">
        <div className="flex min-w-0 flex-1 items-stretch gap-1 overflow-hidden">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveTabId(tab.id)
                  setIsRenamingTab(false)
                }}
                onDoubleClick={() => {
                  setRenameTabTitle(tab.title)
                  setIsRenamingTab(true)
                }}
                title="单击切换，双击修改标题"
                className={cn(
                  "group flex min-w-0 shrink-0 max-w-[130px] items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "border-green-600 bg-white text-green-700 font-semibold"
                    : "border-transparent text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
                )}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    isActive ? "bg-green-600" : "bg-stone-300"
                  )}
                />
                <span className="truncate">{tab.title || "未命名待办"}</span>
                {tabs.length > 1 && (
                  <span
                    role="button"
                    aria-label="关闭 Tab"
                    onClick={(e) => {
                      e.stopPropagation()
                      confirmDelete("删除这个待办表格及其全部内容？", () => handleDeleteTab(tab.id))
                    }}
                    className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-stone-200 hover:text-stone-900"
                  >
                    <X className="size-3 text-stone-400" />
                  </span>
                )}
              </button>
            )
          })}

          <button
            aria-label="新建待办事项 Tab"
            onClick={handleAddTab}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-200/70 hover:text-green-700"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* 2. 待办详情头部 */}
      {activeTab ? (
        <>
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
            {isRenamingTab ? (
              <div className="flex items-center gap-2">
                <ClipboardList className="size-4 text-green-600" />
                <Input
                  autoFocus
                  value={renameTabTitle}
                  onChange={(e) => setRenameTabTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === "Enter") handleSaveTabRename(); if (e.key === "Escape") setIsRenamingTab(false) }}
                  aria-label="待办表格名称"
                  className={cn(greenInput, "h-7 text-xs font-semibold")}
                />
                <button
                  onClick={handleSaveTabRename}
                  className="flex size-6 items-center justify-center rounded bg-green-700 text-white hover:bg-green-800"
                  title="保存名称"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  onClick={() => setIsRenamingTab(false)}
                  className="flex size-6 items-center justify-center rounded bg-stone-200 text-stone-600 hover:bg-stone-300"
                  title="取消"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <div
                onDoubleClick={() => {
                  setRenameTabTitle(activeTab.title)
                  setIsRenamingTab(true)
                }}
                className="flex items-center gap-2 text-sm font-bold text-stone-900 cursor-pointer hover:text-green-700 transition-colors"
                title="双击修改标题名称"
              >
                <ClipboardList className="size-4 text-green-600" />
                <span>{activeTab.title}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyDetails}
                title="复制详情"
                className="flex size-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-green-700"
              >
                <Copy className="size-3.5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title="更多操作"
                    className="flex size-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-green-700"
                  >
                    <MoreVertical className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36 bg-white z-[200]">
                  <DropdownMenuItem
                    onSelect={() => {
                      setRenameTabTitle(activeTab.title)
                      setIsRenamingTab(true)
                    }}
                  >
                    <Pencil className="mr-2 size-3.5" /> 重命名 Tab
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleCopyDetails}>
                    <Copy className="mr-2 size-3.5" /> 复制详情
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600"
                    onSelect={() => confirmDelete("删除这个待办表格及其全部内容？", () => handleDeleteTab(activeTab.id))}
                  >
                    <Trash2 className="mr-2 size-3.5" /> 删除 Tab
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 3. 使用 shadcn 的 Table 组件进行渲染 */}
          <div className="todo-table-scroll">
            <Table style={{ minWidth: activeTab.columns.reduce((total, col) => total + (col.type === "text" ? 260 : col.type === "action" ? 100 : 170), 112) }} className="w-full table-fixed border-collapse text-left text-xs">
              <TableHeader>
                <TableRow className="border-b border-stone-100 bg-[#faf9f7] hover:bg-[#faf9f7]">
                  {activeTab.columns.map((col) => {
                    const typeMeta = COLUMN_TYPES_META[col.type]
                    const IconComp = typeMeta.icon
                    return (
                      <TableHead
                        key={col.id}
                        style={{ width: col.type === "text" ? 260 : col.type === "action" ? 100 : 170, ...(col.type === "action" ? { right: 112 + activeTab.columns.slice(activeTab.columns.indexOf(col) + 1).filter(c => c.type === "action").length * 100 } : {}) }}
                        className={cn("group relative px-4 py-3 font-semibold text-stone-500 whitespace-nowrap", col.type === "action" && "todo-sticky-action")}
                      >
                        <div className="flex items-center gap-2">
                          <IconComp className="size-3.5 shrink-0 text-stone-400" />
                          <EditableColumnTitle title={col.title} onRename={title => setTabs(current => current.map(tab => tab.id === activeTab.id ? { ...tab, columns: tab.columns.map(column => column.id === col.id ? { ...column, title } : column) } : tab))} />
                          {activeTab.columns.length > 1 && (
                            <button
                              onClick={() => confirmDelete(`删除「${col.title}」列？`, () => handleRemoveColumn(col.id))}
                              className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 hover:text-red-600 text-stone-300"
                              title="删除列"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      </TableHead>
                    )
                  })}

                  {/* 添加列按钮 */}
                  <TableHead className="todo-sticky-add w-28 px-3 py-2">
                    <Popover open={showAddColPopover} onOpenChange={setShowAddColPopover}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 text-stone-400 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded transition-colors">
                          <Plus className="size-3.5" />
                          <span>添加列</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56 p-1.5 bg-white z-[200] shadow-2xl">
                        <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                          选择列类型
                        </div>
                        {(Object.keys(COLUMN_TYPES_META) as ColumnTypeKey[]).filter(key => key !== "action").map((key) => {
                          const meta = COLUMN_TYPES_META[key]
                          const IconC = meta.icon
                          return (
                            <button
                              key={key}
                              onClick={() => handleAddColumn(key)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-stone-100 hover:text-green-700 transition-colors"
                            >
                              <span className="flex size-7 items-center justify-center rounded-md bg-stone-100 text-stone-600">
                                <IconC className="size-3.5" />
                              </span>
                              <div>
                                <div className="font-semibold text-stone-800">{meta.label}</div>
                                <div className="text-[10px] text-stone-400">{meta.desc}</div>
                              </div>
                            </button>
                          )
                        })}
                      </PopoverContent>
                    </Popover>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {activeTab.rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors"
                  >
                    {activeTab.columns.map((col) => (
                      <TableCell key={col.id} style={col.type === "action" ? { right: 112 + activeTab.columns.slice(activeTab.columns.indexOf(col) + 1).filter(c => c.type === "action").length * 100 } : undefined} className={cn("px-4 py-2.5 align-middle", col.type === "action" && "todo-sticky-action")}>
                        <TodoCell col={col} row={row} isEditingTitle={editingRowId === row.id}
                          onStartEditingTitle={() => setEditingRowId(row.id)} onStopEditingTitle={() => setEditingRowId(null)}
                          onUpdateRow={patch => handleUpdateRow(row.id, patch)} onChangeAllProgressColor={handleChangeAllProgressColor}
                          onDeleteRow={() => confirmDelete(`删除「${row.title || "未命名"}」这一行？`, () => handleDeleteRow(row.id))}
                          suggestedPeople={[...new Set(tabs.flatMap(tab => tab.rows.flatMap(item => item.person ? [item.person.name] : [])))]}
                          suggestedTags={[...new Set(tabs.flatMap(tab => tab.rows.flatMap(item => (item.tags || []).map(tag => tag.label))))]}
                          confirmDelete={confirmDelete} />
                      </TableCell>
                    ))}
                    <TableCell className="todo-sticky-add" />
                  </TableRow>
                ))}

                {/* 新增行按钮 */}
                <TableRow className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                  <TableCell colSpan={activeTab.columns.length + 1} className="px-4 py-2.5">
                    <button
                      onClick={handleAddRow}
                      className="flex items-center gap-1.5 text-stone-400 hover:text-green-700 font-medium text-xs py-1 px-2 rounded hover:bg-green-50 transition-colors"
                    >
                      <Plus className="size-3.5" />
                      <span>新增行</span>
                    </button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* 4. 底部信息栏 */}
          <div className="flex items-center justify-between border-t border-stone-100 bg-[#faf9f7] px-5 py-3 text-xs text-stone-500">
            <div>
              当前待办：<span className="font-medium text-stone-700">{activeTab.title}</span> · 共 {activeTab.rows.length} 行，{activeTab.columns.length} 个属性列
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function TodoCell({ col, row, isEditingTitle, onStartEditingTitle, onStopEditingTitle, onUpdateRow, onChangeAllProgressColor, onDeleteRow, suggestedTags, suggestedPeople, confirmDelete }: {
  col: ColumnDef
  row: TableRowData
  isEditingTitle: boolean
  onStartEditingTitle: () => void
  onStopEditingTitle: () => void
  onUpdateRow: (patch: Partial<TableRowData>) => void
  onChangeAllProgressColor: (colorClass: string) => void
  onDeleteRow: () => void
  suggestedTags: string[]
  suggestedPeople: string[]
  confirmDelete: (title: string, action: () => void) => void
}) {
  switch (col.type) {
    case "text":
      return (
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={row.completed}
            onChange={() => onUpdateRow({ completed: !row.completed })}
            className="size-4 rounded accent-green-600 cursor-pointer shrink-0"
          />
          {isEditingTitle ? (
            <Input
              autoFocus
              value={row.title}
              onChange={(e) => onUpdateRow({ title: e.target.value })}
              onBlur={onStopEditingTitle}
              onKeyDown={(e) => { if (!e.nativeEvent.isComposing && e.key === "Enter") onStopEditingTitle() }}
              aria-label="编辑文本属性"
              className={cn(greenInput, "h-7 text-xs font-normal")}
              placeholder="输入任务名称..."
            />
          ) : (
            <span
              onDoubleClick={onStartEditingTitle}
              className={cn(
                "cursor-pointer font-normal text-stone-800 text-xs py-0.5 hover:text-green-700 transition-colors",
                row.completed && "line-through text-stone-400",
                !row.title && "text-stone-400 italic"
              )}
              title="双击修改标题名称"
            >
              {row.title || "输入任务名称..."}
            </span>
          )}
        </div>
      )

    case "person":
      return (
        <PersonCell
          confirmDelete={confirmDelete}
          suggestions={suggestedPeople}
          person={row.person}
          onUpdatePerson={(person) => onUpdateRow({ person })}
        />
      )

    case "tag":
      return (
        <TagCell
          tags={row.tags}
          suggestions={suggestedTags}
          confirmDelete={confirmDelete}
          onUpdateTags={(tags) => onUpdateRow({ tags })}
        />
      )

    case "progress":
      return (
        <ProgressCell
          progress={row.progress}
          onUpdateProgressValue={(val) =>
            onUpdateRow({ progress: { value: val, colorClass: row.progress?.colorClass || "bg-green-600" } })
          }
          onChangeAllProgressColor={onChangeAllProgressColor}
        />
      )

    case "time":
      return (
        <TimeCell
          time={row.time}
          onUpdateTime={(time) => onUpdateRow({ time })}
        />
      )

    case "status":
      return (
        <StatusCell
          status={row.status}
          onUpdateStatus={(status) => onUpdateRow({ status })}
        />
      )

    case "action":
      return (
        <div className="flex items-center gap-1">
          <button
            title="编辑标题"
            onClick={onStartEditingTitle}
            className="flex size-7 items-center justify-center rounded hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            title="删除行"
            onClick={onDeleteRow}
            className="flex size-7 items-center justify-center rounded hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )

    default:
      return null
  }
}

/* ============================================================
 * 人物属性单元格 (无默认值，添加后才有值)
 * ========================================================== */
function PersonCell({
  suggestions,
  confirmDelete,
  person,
  onUpdatePerson
}: {
  confirmDelete: (title: string, action: () => void) => void
  suggestions: string[]
  person?: { name: string; avatarColor?: string }
  onUpdatePerson: (person: { name: string; avatarColor?: string } | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState("")

  const listId = useId()
  const [highlight, setHighlight] = useState(0)
  const query = inputVal.trim()
  const known = [...new Set(suggestions)]
  const matches = known.filter(name => name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const canCreate = !!query && !known.some(name => name.toLocaleLowerCase() === query.toLocaleLowerCase())
  const choices = [...matches.map(label => ({ label, create: false })), ...(canCreate ? [{ label: query, create: true }] : [])]
  const selectedIndex = Math.min(highlight, Math.max(0, choices.length - 1))
  const handleAddPerson = (name: string) => {
    if (!name.trim()) return
    const colors = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-stone-600"]
    const color = colors[Math.abs(name.charCodeAt(0)) % colors.length]
    onUpdatePerson({ name: name.trim(), avatarColor: color })
    setOpen(false)
    setInputVal("")
  }

  return (
    <div className="flex items-center gap-2">
      {person ? (
        <div className="group relative flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1">
          <span className={cn("flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white", person.avatarColor || "bg-emerald-600")}>
            {person.name[0]}
          </span>
          <span className="text-xs font-normal text-stone-700">{person.name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-stone-200 text-stone-400 transition-opacity">
                <MoreVertical className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32 bg-white z-[200]">
              <DropdownMenuItem className="text-red-600 text-xs" onClick={() => confirmDelete("删除这个负责人？", () => onUpdatePerson(undefined))}>
                <Trash2 className="mr-2 size-3.5" /> 删除人物
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Popover open={open} onOpenChange={value => { setOpen(value); setInputVal(""); setHighlight(0) }}>
          <PopoverTrigger asChild>
            <button aria-label="添加负责人" className="flex size-6 items-center justify-center rounded border border-dashed border-stone-300 text-stone-400 hover:border-green-600 hover:text-green-600 transition-colors">
              <Plus className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-2 bg-white shadow-xl z-[200]">
            <div className="text-[11px] font-bold text-stone-400 mb-1.5 px-1">添加负责人</div>
            <Input role="combobox" aria-label="搜索或新增负责人" aria-expanded={open} aria-autocomplete="list" aria-controls={listId}
              aria-activedescendant={choices.length ? `${listId}-${selectedIndex}` : undefined}
              value={inputVal} onChange={e => { setInputVal(e.target.value); setHighlight(0) }}
              onKeyDown={e => {
                if (e.nativeEvent.isComposing) return
                if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((selectedIndex + 1) % Math.max(1, choices.length)) }
                if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((selectedIndex - 1 + choices.length) % Math.max(1, choices.length)) }
                if (e.key === "Enter") { e.preventDefault(); if (choices[selectedIndex]) handleAddPerson(choices[selectedIndex].label) }
              }} placeholder="搜索姓名，回车添加…" className={cn(greenInput, "h-8 text-xs mb-2")} autoFocus />
            <div id={listId} role="listbox" aria-label="负责人建议" className="max-h-48 overflow-y-auto">
              {choices.map((choice, index) => <button key={choice.label} type="button" role="option" id={`${listId}-${index}`} aria-selected={selectedIndex === index} onMouseEnter={() => setHighlight(index)} onMouseDown={e => e.preventDefault()} onClick={() => handleAddPerson(choice.label)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-stone-600 aria-selected:bg-green-50 aria-selected:text-green-700"><Plus className="size-3" />{choice.create ? `创建「${choice.label}」` : choice.label}</button>)}
              {!choices.length && <p className="p-2 text-xs text-stone-400">输入姓名创建负责人</p>}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

/* ============================================================
 * Tag 属性单元格 (无默认值，添加后才有值)
 * ========================================================== */
function TagCell({
  confirmDelete,
  tags = [],
  suggestions,
  onUpdateTags
}: {
  tags?: { id: string; label: string; colorClass?: string }[]
  suggestions: string[]
  confirmDelete: (title: string, action: () => void) => void
  onUpdateTags: (tags: { id: string; label: string; colorClass?: string }[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState("")

  const listId = useId()
  const [highlight, setHighlight] = useState(0)
  const query = inputVal.trim()
  const known = [...new Set(suggestions)]
  const matches = known.filter(label => !tags.some(tag => tag.label.toLocaleLowerCase() === label.toLocaleLowerCase()) && label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const canCreate = !!query && !known.some(label => label.toLocaleLowerCase() === query.toLocaleLowerCase()) && !tags.some(tag => tag.label.toLocaleLowerCase() === query.toLocaleLowerCase())
  const choices = [...matches.map(label => ({ label, create: false })), ...(canCreate ? [{ label: query, create: true }] : [])]
  const selectedIndex = Math.min(highlight, Math.max(0, choices.length - 1))
  const handleAddTag = (label: string) => {
    if (!label.trim() || tags.some(tag => tag.label.toLocaleLowerCase() === label.trim().toLocaleLowerCase())) return
    const newTag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      label: label.trim(),
      colorClass: COLOR_PRESETS[tags.length % COLOR_PRESETS.length].class
    }
    onUpdateTags([...tags, newTag])
    setInputVal("")
    setOpen(false)
  }

  const handleRemoveTag = (tagId: string) => {
    confirmDelete("删除这个标签？", () => onUpdateTags(tags.filter((t) => t.id !== tagId)))
  }

  const handleChangeColor = (tagId: string, colorClass: string) => {
    onUpdateTags(tags.map((t) => (t.id === tagId ? { ...t, colorClass } : t)))
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tags.map((tag) => (
        <div
          key={tag.id}
          className={cn(
            "group relative inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-normal transition-all",
            tag.colorClass || "bg-blue-50 text-blue-600 border-blue-200"
          )}
        >
          <span>{tag.label}</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded transition-opacity" title="编辑颜色/更多">
                <MoreVertical className="size-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32 bg-white z-[200]">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  修改颜色
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-white p-1 z-[210]">
                  {COLOR_PRESETS.map((c) => (
                    <DropdownMenuItem
                      key={c.name}
                      onClick={() => handleChangeColor(tag.id, c.class)}
                      className="text-xs flex items-center gap-2"
                    >
                      <span className={cn("size-2.5 rounded-full border", c.class)} />
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 text-xs"
                onClick={() => handleRemoveTag(tag.id)}
              >
                <Trash2 className="mr-2 size-3" /> 删除 Tag
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => handleRemoveTag(tag.id)}
            className="opacity-0 group-hover:opacity-100 hover:text-red-600 ml-0.5 transition-opacity"
            title="右上角删除 Tag"
          >
            <X className="size-2.5" />
          </button>
        </div>
      ))}

      <Popover open={open} onOpenChange={value => { setOpen(value); setInputVal(""); setHighlight(0) }}>
        <PopoverTrigger asChild>
          <button aria-label="添加标签" className="flex size-6 items-center justify-center rounded border border-dashed border-stone-300 text-stone-400 hover:border-green-600 hover:text-green-600 transition-colors">
            <Plus className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2 bg-white shadow-xl z-[200]">
          <div className="text-[11px] font-bold text-stone-400 mb-1.5 px-1">添加 Tag</div>
          <Input
            role="combobox" aria-label="搜索或新增标签" aria-expanded={open} aria-autocomplete="list" aria-controls={listId}
            aria-activedescendant={choices.length ? `${listId}-${selectedIndex}` : undefined}
            value={inputVal}
            onChange={e => { setInputVal(e.target.value); setHighlight(0) }}
            onKeyDown={e => {
              if (e.nativeEvent.isComposing) return
              if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((selectedIndex + 1) % Math.max(1, choices.length)) }
              if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((selectedIndex - 1 + choices.length) % Math.max(1, choices.length)) }
              if (e.key === "Enter") { e.preventDefault(); if (choices[selectedIndex]) handleAddTag(choices[selectedIndex].label) }
            }}
            placeholder="搜索 Tag，回车添加…"
            className={cn(greenInput, "h-8 text-xs mb-2")}
            autoFocus
          />
          <div id={listId} role="listbox" aria-label="标签建议" className="max-h-48 overflow-y-auto">
            {choices.map((choice, index) => <button key={choice.label} type="button" role="option" id={`${listId}-${index}`} aria-selected={selectedIndex === index} onMouseEnter={() => setHighlight(index)} onMouseDown={e => e.preventDefault()} onClick={() => handleAddTag(choice.label)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-stone-600 aria-selected:bg-green-50 aria-selected:text-green-700"><Plus className="size-3" />{choice.create ? `创建「${choice.label}」` : choice.label}</button>)}
            {!choices.length && <p className="p-2 text-xs text-stone-400">{query ? "该标签已添加" : "输入名称创建标签"}</p>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/* ============================================================
 * 进度属性单元格：使用 shadcn Slider 组件 + 同步全局同列颜色
 * ========================================================== */
function ProgressCell({
  progress,
  onUpdateProgressValue,
  onChangeAllProgressColor
}: {
  progress?: { value: number; colorClass?: string }
  onUpdateProgressValue: (val: number) => void
  onChangeAllProgressColor: (colorClass: string) => void
}) {
  const [open, setOpen] = useState(false)
  const val = progress?.value ?? 0
  const color = progress?.colorClass || "bg-green-600"
  const accent = ({ "bg-green-600": "#16a34a", "bg-blue-600": "#2563eb", "bg-purple-600": "#9333ea", "bg-amber-600": "#d97706", "bg-red-600": "#dc2626" } as Record<string, string>)[color] || "#16a34a"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-2 w-full cursor-pointer py-1 px-1 rounded hover:bg-stone-100/70 transition-colors">
          <div className="h-2 min-w-[60px] flex-1 rounded-full bg-stone-100 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${val}%` }} />
          </div>
          <span className="text-[11px] font-normal text-stone-500 w-8 text-right">{val}%</span>
          <MoreVertical className="size-3 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="todo-progress-picker w-56 p-3 bg-white shadow-xl z-[200]" style={{ "--progress-color": accent } as CSSProperties}>
        <div style={{ color: accent }} className="text-xs font-bold mb-2">修改进度: {val}%</div>
        
        {/* 需求 3：使用 shadcn 的 Slider 滚动条组件 */}
        <div className="mb-3 px-1">
          <Slider
            aria-label="待办进度"
            value={[val]}
            onValueChange={([v]) => onUpdateProgressValue(v)}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        <div className="flex gap-1 mb-3">
          {[0, 25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => onUpdateProgressValue(p)}
              className={cn(
                "flex-1 py-0.5 text-[10px] rounded border transition-colors",
                val === p ? "border-green-600 bg-green-50 text-green-700 font-bold" : "border-stone-200 hover:bg-stone-50 text-stone-600"
              )}
            >
              {p}%
            </button>
          ))}
        </div>

        {/* 需求 2：修改进度条颜色，同步同属性列的全部进度条颜色 */}
        <div className="text-[10px] text-stone-400 mb-1.5">进度条统一颜色 (同步整列):</div>
        <div className="flex gap-2">
          {[
            { label: "绿色", class: "bg-green-600" },
            { label: "蓝色", class: "bg-blue-600" },
            { label: "紫色", class: "bg-purple-600" },
            { label: "橙色", class: "bg-amber-600" },
            { label: "红色", class: "bg-red-600" }
          ].map((c) => (
            <button
              key={c.label}
              onClick={() => onChangeAllProgressColor(c.class)}
              className={cn(
                "size-5 rounded-full border border-stone-300 hover:scale-110 transition-transform flex items-center justify-center",
                c.class
              )}
              title={`整列改为${c.label}`}
            >
              {color === c.class && <Check className="size-3 text-white" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ============================================================
 * 时间属性单元格
 * ========================================================== */
function TimeCell({
  time,
  onUpdateTime
}: {
  time?: string
  onUpdateTime: (t: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseTodoDate(time))

  const days = monthDays(viewDate)
  const todayKey = dateKey(new Date())

  const handleSelectDay = (d: Date) => {
    const formatted = formatTodoDate(d)
    onUpdateTime(formatted)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-1.5 cursor-pointer py-1 px-1.5 rounded border border-transparent hover:border-stone-200 hover:bg-stone-100/70 transition-colors">
          <CalendarIcon className="size-3.5 shrink-0 text-stone-400" />
          <span className="text-stone-700 font-mono text-xs font-normal whitespace-nowrap">{time ? formatTodoDate(parseTodoDate(time)) : "选择日期"}</span>
          <MoreVertical className="size-3 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-3 bg-white shadow-2xl z-[200]">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-2">
          <button
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            className="p-1 rounded hover:bg-stone-100 text-stone-500"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs font-bold text-stone-800">
            {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月
          </span>
          <button
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            className="p-1 rounded hover:bg-stone-100 text-stone-500"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-stone-400 mb-1">
          {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs mb-2.5">
          {days.map((date) => {
            const isCurrentMonth = date.getMonth() === viewDate.getMonth()
            const isToday = dateKey(date) === todayKey
            const isSelected = !!time && dateKey(date) === dateKey(parseTodoDate(time))
            return (
              <button
                key={dateKey(date)}
                aria-label={formatTodoDate(date)}
                aria-pressed={isSelected}
                onClick={() => handleSelectDay(date)}
                className={cn(
                  "size-7 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors",
                  !isCurrentMonth && "text-stone-300",
                  isCurrentMonth && "text-stone-700 hover:bg-green-50 hover:text-green-700",
                  isToday && !isSelected && "ring-1 ring-green-200",
                  isSelected && "bg-green-600 text-white font-bold hover:bg-green-700 hover:text-white"
                )}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>

        <div className="flex justify-between border-t border-stone-100 pt-2 text-[11px]">
          <button
            onClick={() => handleSelectDay(new Date())}
            className="px-2.5 py-1 rounded bg-stone-100 hover:bg-green-50 hover:text-green-700 text-stone-600 font-medium transition-colors"
          >
            今天
          </button>
          <button
            onClick={() => {
              const tm = new Date()
              tm.setDate(tm.getDate() + 1)
              handleSelectDay(tm)
            }}
            className="px-2.5 py-1 rounded bg-stone-100 hover:bg-green-50 hover:text-green-700 text-stone-600 font-medium transition-colors"
          >
            明天
          </button>
          <button
            onClick={() => {
              const nw = new Date()
              nw.setDate(nw.getDate() + 7)
              handleSelectDay(nw)
            }}
            className="px-2.5 py-1 rounded bg-stone-100 hover:bg-green-50 hover:text-green-700 text-stone-600 font-medium transition-colors"
          >
            下周
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ============================================================
 * 状态属性单元格
 * ========================================================== */
function StatusCell({
  status,
  onUpdateStatus
}: {
  status?: { key: string; label: string; colorClass?: string }
  onUpdateStatus: (st: { key: string; label: string; colorClass?: string }) => void
}) {
  const current = status || { key: "doing", label: "进行中", colorClass: "bg-blue-50 text-blue-600 border-blue-200" }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="group flex items-center gap-1.5 cursor-pointer">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-normal border transition-colors",
              current.colorClass || "bg-blue-50 text-blue-600 border-blue-200"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                current.key === "done" ? "bg-emerald-600" : current.key === "doing" ? "bg-blue-600" : current.key === "overdue" ? "bg-red-600" : "bg-stone-400"
              )}
            />
            {current.label}
          </span>
          <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-stone-100 text-stone-400 transition-opacity">
            <MoreVertical className="size-3" />
          </button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36 bg-white z-[200]">
        <div className="px-2 py-1 text-[10px] font-bold text-stone-400 uppercase">更改状态/颜色</div>
        {STATUS_OPTIONS.map((st) => (
          <DropdownMenuItem
            key={st.key}
            onClick={() => onUpdateStatus({ key: st.key, label: st.label, colorClass: st.colorClass })}
            className="text-xs flex items-center gap-2"
          >
            <span className={cn("size-2 rounded-full", st.dotClass)} />
            {st.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
