import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Pencil, Trash2 } from "lucide-react"

import { PersonCell } from "./person-cell"
import { ProgressCell } from "./progress-cell"
import { StatusCell } from "./status-cell"
import { TagCell } from "./tag-cell"
import { TimeCell } from "./time-cell"
import { greenInput, type ColumnDef, type TableRowData } from "./todo-table-model"

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
