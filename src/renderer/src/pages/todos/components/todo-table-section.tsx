import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Activity, Calendar as CalendarIcon, Check, CheckCircle2, ClipboardList, Copy, MoreVertical, Pencil, Plus, Tag as TagIcon, Trash2, Type, User, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react"
import { toast } from "sonner"
import { TodoCell } from "./todo-cell"
import { formatTodoDate, greenInput, type ColumnDef, type ColumnTypeKey, type TableRowData, type TodoTab } from "./todo-table-model"
import "./todo-table-section.css"
export type { ColumnDef, ColumnTypeKey, TableRowData, TodoTab } from "./todo-table-model"

const COLUMN_TYPES_META: Record<ColumnTypeKey, { label: string; desc: string; icon: typeof Type }> = {
  text: { label: "文本属性", desc: "普通文字内容", icon: Type },
  person: { label: "人物属性", desc: "负责人 / 成员", icon: User },
  tag: { label: "Tag 属性", desc: "标签 / 分类", icon: TagIcon },
  time: { label: "时间属性", desc: "日期 / 截止时间", icon: CalendarIcon },
  status: { label: "状态属性", desc: "进行中 / 已完成等", icon: CheckCircle2 },
  progress: { label: "进度属性", desc: "百分比进度条", icon: Activity },
  action: { label: "操作属性", desc: "编辑 / 删除按钮", icon: MoreVertical }
}

function EditableColumnTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(title)
  const save = () => {
    if (draft.trim()) onRename(draft.trim())
    setEditing(false)
  }
  return editing ? (
    <Input
      autoFocus
      aria-label="列标题"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === "Enter") save()
        if (e.key === "Escape") setEditing(false)
      }}
      className={cn(greenInput, "h-7 min-w-0 text-xs")}
    />
  ) : (
    <span
      title="双击修改列标题"
      onDoubleClick={() => {
        setDraft(title)
        setEditing(true)
      }}
      className="cursor-text"
    >
      {title}
    </span>
  )
}
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
        if (!Array.isArray(next) || !next.length || !next.every((tab) => typeof tab.id === "string" && typeof tab.title === "string" && Array.isArray(tab.rows) && Array.isArray(tab.columns) && tab.columns.every((col) => col.type in COLUMN_TYPES_META))) throw new Error("待办数据格式无效")
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
      } catch {
        if (!cancelled) setStorageError("无法读取或迁移待办数据，原数据已保留，请重试。")
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [loadAttempt])
  const setTabs = useCallback(
    (change: SetStateAction<TodoTab[]>) => {
      if (!loaded) return
      const next = typeof change === "function" ? change(latestTabs.current) : change
      latestTabs.current = next
      updateTabs(next)
      // Serialize writes so fast edits cannot overwrite newer values with older ones.
      writes.current = writes.current
        .then(() => window.electronAPI.setAppState("todo-tables-v1", next))
        .then(() => setStorageError(""))
        .catch(() => setStorageError("无法保存到 SQLite，请检查磁盘空间后重试保存。"))
    },
    [loaded]
  )
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
    setTabs(tabs.map((t) => (t.id === activeTab.id ? { ...t, title: trimmed } : t)))
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

    setTabs(tabs.map((t) => (t.id === activeTab.id ? { ...t, columns: nextCols } : t)))
    setShowAddColPopover(false)
  }

  // 删除列
  const handleRemoveColumn = (colId: string) => {
    if (!activeTab) return
    if (activeTab.columns.length <= 1) {
      setStorageError("至少保留一列")
      return
    }
    setTabs(tabs.map((t) => (t.id === activeTab.id ? { ...t, columns: t.columns.filter((c) => c.id !== colId) } : t)))
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
    setTabs(tabs.map((t) => (t.id === activeTab.id ? { ...t, rows: [...t.rows, newRow] } : t)))
    setEditingRowId(newRowId)
  }

  // 删除行
  const handleDeleteRow = (rowId: string) => {
    if (!activeTab) return
    setTabs(tabs.map((t) => (t.id === activeTab.id ? { ...t, rows: t.rows.filter((r) => r.id !== rowId) } : t)))
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
    void navigator.clipboard.writeText(`待办名称：${activeTab.title}\n包含 ${activeTab.rows.length} 行数据，${activeTab.columns.length} 个属性列`)
    toast.success("已复制待办详情")
  }

  if (!loaded)
    return (
      <div
        className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 text-sm"
        role={storageError ? "alert" : "status"}
      >
        {storageError || "正在加载待办表格…"}
        {storageError && (
          <button
            className="ml-3 text-green-700"
            onClick={() => setLoadAttempt((value) => value + 1)}
          >
            重试
          </button>
        )}
      </div>
    )
  return (
    <div className="todo-table-section mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null)
        }}
      >
        <AlertDialogContent
          className="todo-confirm-dialog"
          overlayClassName="!z-[230] !bg-black/45"
        >
          <div className="todo-confirm-heading">
            <span
              className="todo-confirm-icon"
              aria-hidden="true"
            >
              <Trash2 />
            </span>
            <AlertDialogHeader className="todo-confirm-text">
              <AlertDialogTitle className="todo-confirm-title">{confirmation?.title}</AlertDialogTitle>
              <AlertDialogDescription className="todo-confirm-description">删除后无法恢复，请确认是否继续。</AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="todo-confirm-actions">
            <AlertDialogCancel className="todo-confirm-cancel">取消</AlertDialogCancel>
            <AlertDialogAction
              className="todo-confirm-delete"
              onClick={() => {
                confirmation?.action()
                setConfirmation(null)
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {storageError && (
        <p
          role="alert"
          className="px-4 py-2 text-xs text-red-600"
        >
          {storageError}
          <button
            className="ml-2 underline"
            onClick={() => setTabs(latestTabs.current)}
          >
            重试保存
          </button>
        </p>
      )}
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
                  isActive ? "border-green-600 bg-white text-green-700 font-semibold" : "border-transparent text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", isActive ? "bg-green-600" : "bg-stone-300")} />
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
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return
                    if (e.key === "Enter") handleSaveTabRename()
                    if (e.key === "Escape") setIsRenamingTab(false)
                  }}
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
                <DropdownMenuContent
                  align="end"
                  className="w-36 bg-white z-[200]"
                >
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
            <Table
              style={{ minWidth: activeTab.columns.reduce((total, col) => total + (col.type === "text" ? 260 : col.type === "action" ? 100 : 170), 112) }}
              className="w-full table-fixed border-collapse text-left text-xs"
            >
              <TableHeader>
                <TableRow className="border-b border-stone-100 bg-[#faf9f7] hover:bg-[#faf9f7]">
                  {activeTab.columns.map((col) => {
                    const typeMeta = COLUMN_TYPES_META[col.type]
                    const IconComp = typeMeta.icon
                    return (
                      <TableHead
                        key={col.id}
                        style={{ width: col.type === "text" ? 260 : col.type === "action" ? 100 : 170, ...(col.type === "action" ? { right: 112 + activeTab.columns.slice(activeTab.columns.indexOf(col) + 1).filter((c) => c.type === "action").length * 100 } : {}) }}
                        className={cn("group relative px-4 py-3 font-semibold text-stone-500 whitespace-nowrap", col.type === "action" && "todo-sticky-action")}
                      >
                        <div className="flex items-center gap-2">
                          <IconComp className="size-3.5 shrink-0 text-stone-400" />
                          <EditableColumnTitle
                            title={col.title}
                            onRename={(title) => setTabs((current) => current.map((tab) => (tab.id === activeTab.id ? { ...tab, columns: tab.columns.map((column) => (column.id === col.id ? { ...column, title } : column)) } : tab)))}
                          />
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
                    <Popover
                      open={showAddColPopover}
                      onOpenChange={setShowAddColPopover}
                    >
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 text-stone-400 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded transition-colors">
                          <Plus className="size-3.5" />
                          <span>添加列</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-56 p-1.5 bg-white z-[200] shadow-2xl"
                      >
                        <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-stone-400 uppercase">选择列类型</div>
                        {(Object.keys(COLUMN_TYPES_META) as ColumnTypeKey[])
                          .filter((key) => key !== "action")
                          .map((key) => {
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
                      <TableCell
                        key={col.id}
                        style={col.type === "action" ? { right: 112 + activeTab.columns.slice(activeTab.columns.indexOf(col) + 1).filter((c) => c.type === "action").length * 100 } : undefined}
                        className={cn("px-4 py-2.5 align-middle", col.type === "action" && "todo-sticky-action")}
                      >
                        <TodoCell
                          col={col}
                          row={row}
                          isEditingTitle={editingRowId === row.id}
                          onStartEditingTitle={() => setEditingRowId(row.id)}
                          onStopEditingTitle={() => setEditingRowId(null)}
                          onUpdateRow={(patch) => handleUpdateRow(row.id, patch)}
                          onChangeAllProgressColor={handleChangeAllProgressColor}
                          onDeleteRow={() => confirmDelete(`删除「${row.title || "未命名"}」这一行？`, () => handleDeleteRow(row.id))}
                          suggestedPeople={[...new Set(tabs.flatMap((tab) => tab.rows.flatMap((item) => (item.person ? [item.person.name] : []))))]}
                          suggestedTags={[...new Set(tabs.flatMap((tab) => tab.rows.flatMap((item) => (item.tags || []).map((tag) => tag.label))))]}
                          confirmDelete={confirmDelete}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="todo-sticky-add" />
                  </TableRow>
                ))}

                {/* 新增行按钮 */}
                <TableRow className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                  <TableCell
                    colSpan={activeTab.columns.length + 1}
                    className="px-4 py-2.5"
                  >
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
