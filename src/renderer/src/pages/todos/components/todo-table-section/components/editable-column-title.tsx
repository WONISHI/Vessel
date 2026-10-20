import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { greenInput } from "@/pages/todos/components/todo-table-model"
import { useState } from "react"

/** Renders the editable column title component. */
export function EditableColumnTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(title)

  /** Saves save. */
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
      data-title="双击修改列标题"
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
