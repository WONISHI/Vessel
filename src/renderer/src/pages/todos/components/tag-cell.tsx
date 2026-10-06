import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { MoreVertical, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { CreatableOptions } from "./creatable-options"

import { COLOR_PRESETS } from "./todo-table-model"

export function TagCell({
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
  const handleAddTag = (label: string) => {
    if (!label.trim() || tags.some((tag) => tag.label.toLocaleLowerCase() === label.trim().toLocaleLowerCase())) return
    const newTag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      label: label.trim(),
      colorClass: COLOR_PRESETS[tags.length % COLOR_PRESETS.length].class
    }
    onUpdateTags([...tags, newTag])
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
          className={cn("group relative inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-normal transition-all", tag.colorClass || "bg-blue-50 text-blue-600 border-blue-200")}
        >
          <span>{tag.label}</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded transition-opacity"
                title="编辑颜色/更多"
              >
                <MoreVertical className="size-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-32 bg-white z-[200]"
            >
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">修改颜色</DropdownMenuSubTrigger>
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

      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <button
            aria-label="添加标签"
            className="flex size-6 items-center justify-center rounded border border-dashed border-stone-300 text-stone-400 hover:border-green-600 hover:text-green-600 transition-colors"
          >
            <Plus className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 p-2 bg-white shadow-xl z-[200]"
        >
          <div className="text-[11px] font-bold text-stone-400 mb-1.5 px-1">添加 Tag</div>
          <CreatableOptions
            open={open}
            suggestions={suggestions}
            excluded={tags.map((tag) => tag.label)}
            inputLabel="搜索或新增标签"
            listLabel="标签建议"
            placeholder="搜索 Tag，回车添加…"
            emptyLabel="输入名称创建标签"
            duplicateLabel="该标签已添加"
            onSelect={handleAddTag}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
