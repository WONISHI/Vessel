import { useState } from "react"
import { Pin, PinOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** 固定时展示标题，取消固定后用静态横线展示标题层级和当前阅读位置。 */
export function DocumentOutline({ headings, activeIndex, onSelect, fileName }: { headings: { text: string; level: number; color?: string }[]; activeIndex: number; onSelect: (index: number) => void; fileName?: string }) {
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const expanded = pinned || hovered
  return (
    <aside
      aria-label="文档大纲"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false)
      }}
      className={cn("flex min-h-0 shrink-0 flex-col py-2 transition-[width]", pinned ? "w-52 px-2" : "relative w-12 px-1")}
    >
      <div className={cn("flex min-h-0 flex-1 flex-col", !pinned && expanded && "absolute inset-y-0 right-0 z-20 w-56 rounded-lg bg-white p-2 shadow-lg ring-1 ring-stone-100")}>
        <div className="flex h-8 shrink-0 items-center justify-end gap-2">
          {expanded && fileName && (
            <span
              title={fileName}
              className="min-w-0 flex-1 truncate px-2 text-xs font-semibold text-stone-700"
            >
              {fileName}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-stone-400 hover:bg-green-600 hover:text-white"
            title={pinned ? "取消固定大纲" : "固定大纲"}
            aria-label={pinned ? "取消固定大纲" : "固定大纲"}
            aria-pressed={pinned}
            onClick={() => setPinned(!pinned)}
          >
            {pinned ? <PinOff className="!size-3.5" /> : <Pin className="!size-3.5" />}
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {headings.map((heading, index) => (
            <Button
              key={index}
              variant="ghost"
              title={heading.text}
              aria-label={heading.text}
              aria-current={index === activeIndex ? "location" : undefined}
              onClick={() => onSelect(index)}
              className={cn("group w-full text-xs font-normal hover:bg-green-600 hover:text-white", expanded ? "h-auto min-h-8 justify-start whitespace-normal py-1.5 text-left" : "h-8 justify-end px-1", index === activeIndex ? "text-green-700" : "text-stone-500")}
              style={expanded ? { paddingLeft: 8 + (heading.level - 1) * 10 } : undefined}
            >
              {expanded ? (
                <span
                  style={{ color: index === activeIndex ? undefined : heading.color }}
                  className="min-w-0 break-words group-hover:!text-white"
                >
                  {heading.text}
                </span>
              ) : (
                <Skeleton
                  aria-hidden="true"
                  className={cn("h-[3px] animate-none rounded-full transition-colors", index === activeIndex ? "bg-green-600" : "bg-stone-300")}
                  style={{ width: Math.max(8, 34 - (heading.level - 1) * 5) }}
                />
              )}
            </Button>
          ))}
          {!headings.length && expanded && <p className="px-2 py-3 text-xs text-stone-400">暂无标题</p>}
        </ScrollArea>
      </div>
    </aside>
  )
}
