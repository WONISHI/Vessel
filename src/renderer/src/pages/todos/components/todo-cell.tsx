import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Pencil, Trash2 } from "lucide-react"

import { PersonCell } from "@/pages/todos/components/person-cell"
import { ProgressCell } from "@/pages/todos/components/progress-cell"
import { StatusCell } from "@/pages/todos/components/status-cell"
import { TagCell } from "@/pages/todos/components/tag-cell"
import { TimeCell } from "@/pages/todos/components/time-cell"
import { greenInput, type ColumnDef, type TableRowData } from "@/pages/todos/components/todo-table-model"

/** Renders the todo cell component. */
export function TodoCell({
  col,
  row,
  isEditingTitle,
  onStartEditingTitle,
  onStopEditingTitle,
  onUpdateRow,
  onChangeAllProgressColor,
  onDeleteRow,
  suggestedTags,
  suggestedPeople,
  confirmDelete
}: {
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
          <Checkbox
            aria-label={`完成：${row.title || "未命名待办"}`}
            checked={row.completed}
            onCheckedChange={(checked) => onUpdateRow({ completed: checked === true })}
            className="cursor-pointer"
          />
          {isEditingTitle ? (
            <Input
              autoFocus
              value={row.title}
              onChange={(e) => onUpdateRow({ title: e.target.value })}
              onBlur={onStopEditingTitle}
              onKeyDown={(e) => {
                if (!e.nativeEvent.isComposing && e.key === "Enter") onStopEditingTitle()
              }}
              aria-label="编辑文本属性"
              className={cn(greenInput, "h-7 text-xs font-normal")}
              placeholder="输入任务名称..."
            />
          ) : (
            <span
              onDoubleClick={onStartEditingTitle}
              className={cn("cursor-pointer font-normal text-stone-800 text-xs py-0.5 hover:text-green-700 transition-colors", row.completed && "line-through text-stone-400", !row.title && "text-stone-400 italic")}
              data-title="双击修改标题名称"
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
          onUpdateProgressValue={(val) => onUpdateRow({ progress: { value: val, colorClass: row.progress?.colorClass || "bg-green-600" } })}
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
            data-title="编辑标题"
            onClick={onStartEditingTitle}
            className="flex size-7 items-center justify-center rounded hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors" aria-label="编辑标题"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            data-title="删除行"
            onClick={onDeleteRow}
            className="flex size-7 items-center justify-center rounded hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors" aria-label="删除行"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )

    default:
      return null
  }
}
