import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { MoreVertical, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { CreatableOptions } from "./creatable-options"

export function PersonCell({
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
  const handleAddPerson = (name: string) => {
    if (!name.trim()) return
    const colors = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-stone-600"]
    const color = colors[Math.abs(name.charCodeAt(0)) % colors.length]
    onUpdatePerson({ name: name.trim(), avatarColor: color })
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      {person ? (
        <div className="group relative flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1">
          <span className={cn("flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white", person.avatarColor || "bg-emerald-600")}>{person.name[0]}</span>
          <span className="text-xs font-normal text-stone-700">{person.name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-stone-200 text-stone-400 transition-opacity">
                <MoreVertical className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-32 bg-white z-[200]"
            >
              <DropdownMenuItem
                className="text-red-600 text-xs"
                onClick={() => confirmDelete("删除这个负责人？", () => onUpdatePerson(undefined))}
              >
                <Trash2 className="mr-2 size-3.5" /> 删除人物
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Popover
          open={open}
          onOpenChange={setOpen}
        >
          <PopoverTrigger asChild>
            <button
              aria-label="添加负责人"
              className="flex size-6 items-center justify-center rounded border border-dashed border-stone-300 text-stone-400 hover:border-green-600 hover:text-green-600 transition-colors"
            >
              <Plus className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-52 p-2 bg-white shadow-xl z-[200]"
          >
            <div className="text-[11px] font-bold text-stone-400 mb-1.5 px-1">添加负责人</div>
            <CreatableOptions
              open={open}
              suggestions={suggestions}
              inputLabel="搜索或新增负责人"
              listLabel="负责人建议"
              placeholder="搜索姓名，回车添加…"
              emptyLabel="输入姓名创建负责人"
              onSelect={handleAddPerson}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
