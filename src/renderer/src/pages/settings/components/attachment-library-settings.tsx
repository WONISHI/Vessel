import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Plus, X } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"

export function AttachmentLibrarySettings({ enabled, folders, onEnabledChange, onFoldersChange }: {
  enabled: boolean
  folders: string[]
  onEnabledChange: (enabled: boolean) => void
  onFoldersChange: (folders: string[]) => void
}) {
  const list = useRef<HTMLDivElement>(null)
  const previousPositions = useRef<number[] | null>(null)
  const dragged = useRef<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  function endDrag() {
    dragged.current = null
    setDropTarget(null)
  }

  useLayoutEffect(() => {
    const positions = previousPositions.current
    previousPositions.current = null
    if (!positions || !list.current) return
    list.current.querySelectorAll("[data-attachment-row]").forEach((row, index) => {
      const offset = positions[index] - row.getBoundingClientRect().top
      if (!offset) return
      row.animate(
        [{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }],
        { duration: 180, easing: "ease-out" }
      )
    })
  }, [folders])

  function move(from: number, to: number) {
    if (list.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const positions = Array.from(list.current.querySelectorAll("[data-attachment-row]"), (row) => {
        const top = row.getBoundingClientRect().top
        row.getAnimations().forEach((animation) => animation.cancel())
        return top
      })
      const [position] = positions.splice(from, 1)
      positions.splice(to, 0, position)
      previousPositions.current = positions
    }
    const next = [...folders]
    const [folder] = next.splice(from, 1)
    next.splice(to, 0, folder)
    onFoldersChange(next)
  }

  return (
    <Collapsible>
      <div className="settings-row">
        <CollapsibleTrigger className="settings-attachment-trigger group min-w-0 flex-1 rounded text-left">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
            附件库
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">开启后，配置的目录会从工作区文件列表隐藏，Markdown 粘贴的图片会保存到第一个可用目录。</span>
        </CollapsibleTrigger>
        <Switch aria-label="开启附件库" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      <CollapsibleContent className="px-5 pb-4">
        <p className="my-2 text-xs text-muted-foreground">使用 ~/images 或 ~images 表示工作区根目录下的 images。也可以输入工作区内的绝对路径。拖动手柄调整优先级。</p>
        <div ref={list} className="space-y-2">
          {folders.map((folder, index) => (
            <div
              key={index}
              data-attachment-row
              className={`flex items-center gap-2 rounded-md ${dropTarget === index ? "outline outline-1 outline-muted-foreground/50" : ""}`}
              onDragOver={(event) => {
                if (dragged.current === null) return
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
                setDropTarget(dragged.current === index ? null : index)
              }}
              onDragLeave={(event) => {
                if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
                setDropTarget((current) => current === index ? null : current)
              }}
              onDrop={(event) => {
                if (dragged.current === null) return
                event.preventDefault()
                const from = dragged.current
                endDrag()
                if (from !== index) move(from, index)
              }}
            >
              <span
                className="cursor-grab text-muted-foreground"
                draggable
                onDragStart={(event) => {
                  const row = event.currentTarget.closest("[data-attachment-row]")
                  if (!row) return
                  const rect = row.getBoundingClientRect()
                  dragged.current = index
                  event.dataTransfer.setData("application/x-vessel-attachment-row", String(index))
                  event.dataTransfer.effectAllowed = "move"
                  event.dataTransfer.setDragImage(row, event.clientX - rect.left, event.clientY - rect.top)
                }}
                onDragEnd={endDrag}
              ><GripVertical size={16} /></span>
              <Input aria-label={`附件目录 ${index + 1}`} value={folder} placeholder="~/images" onChange={(event) => onFoldersChange(folders.map((value, position) => position === index ? event.target.value : value))} />
              <Button type="button" size="icon" variant="ghost" aria-label={`上移附件目录 ${index + 1}`} disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={14} /></Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`下移附件目录 ${index + 1}`} disabled={index === folders.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={14} /></Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`删除附件目录 ${index + 1}`} onClick={() => onFoldersChange(folders.filter((_, position) => position !== index))}><X size={14} /></Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" disabled={folders.length >= 32} onClick={() => onFoldersChange([...folders, ""])}><Plus size={14} />新增文件夹</Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
