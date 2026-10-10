import { SectionPreview } from "./section-preview"
import { useEffect, useRef, useState } from "react"
import { Pin, PinOff, WrapText, AlignLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** 固定时展示标题，取消固定后用静态横线展示标题层级和当前阅读位置。 */
export function DocumentOutline({ headings, activeIndex, onSelect, fileName, sections = [], workspacePath, documentPath }: { headings: { text: string; level: number; color?: string }[]; activeIndex: number; onSelect: (index: number) => void; fileName?: string; sections?: string[]; workspacePath: string; documentPath: string }) {
  const [wrapTitles, setWrapTitles] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const expanded = pinned || hovered || previewIndex !== null
  return (
    <aside
      aria-label="文档大纲"
      onMouseEnter={() => {
        clearTimeout(closeTimer.current)
        setHovered(true)
      }}
      onMouseLeave={() => {
        closeTimer.current = setTimeout(() => setHovered(false), 80)
      }}
      onFocus={() => setHovered(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false)
      }}
      className={cn("relative z-[60] flex min-h-0 shrink-0 flex-col py-2 transition-[width]", pinned ? "w-48 px-2" : "relative w-12 px-1")}
    >
      {!pinned && (
        <div aria-hidden={expanded} inert={expanded} className="flex min-h-0 flex-1 flex-col bg-transparent">
          <div className="h-8 flex justify-end">
            <Pin className="size-3.5 m-1.5 text-stone-400" />
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {headings.map((heading, index) => (
              <button
                key={index}
                aria-label={heading.text}
                aria-current={index === activeIndex ? "location" : undefined}
                onClick={() => onSelect(index)}
                className="flex h-4 w-full items-center justify-end bg-transparent px-1"
              >
                <Skeleton
                  aria-hidden="true"
                  className={cn("h-[3px] animate-none rounded-full", index === activeIndex ? "bg-green-600" : "bg-stone-300")}
                  style={{ width: Math.max(8, 34 - (heading.level - 1) * 5) }}
                />
              </button>
            ))}
          </ScrollArea>
        </div>
      )}
      <div
        aria-hidden={!expanded}
        inert={!expanded}
        style={{ transition: "transform 400ms cubic-bezier(0.22,1,0.36,1), opacity 250ms ease", transform: expanded ? "translateX(0)" : "translateX(24px)", opacity: expanded ? 1 : 0 }}
        className={cn("flex min-h-0 flex-1 flex-col overflow-hidden motion-reduce:!transition-none", pinned ? "w-full" : "absolute inset-y-0 right-0 z-20", !pinned && "w-48 rounded-lg bg-white p-2 shadow-lg ring-1 ring-stone-100")}
      >
        <div className="flex h-8 shrink-0 items-center justify-end gap-2">
          {fileName && (
            <span
              title={fileName}
              className="min-w-0 flex-1 truncate px-2 text-xs font-semibold text-stone-700"
            >
              {fileName}
            </span>
          )}
          {
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-stone-400 hover:bg-green-600 hover:text-white"
              aria-label={wrapTitles ? "标题改为单行显示" : "标题改为换行显示"}
              title={wrapTitles ? "标题改为单行显示" : "标题改为换行显示"}
              aria-pressed={wrapTitles}
              onClick={() => setWrapTitles(!wrapTitles)}
            >
              {wrapTitles ? <AlignLeft className="!size-3.5" /> : <WrapText className="!size-3.5" />}
            </Button>
          }
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
        <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
          {headings.map((heading, index) => (
            <SectionPreview enabled={expanded} onOpenChange={(open) => setPreviewIndex(current => open ? index : current === index ? null : current)} workspacePath={workspacePath} documentPath={documentPath} key={index} source={sections[index] || heading.text}><Button
              variant="ghost"
              aria-label={heading.text}
              aria-current={index === activeIndex ? "location" : undefined}
              onClick={() => onSelect(index)}
              className={cn(
                "group min-w-0 w-full overflow-hidden text-[11px] font-normal hover:bg-green-600 hover:text-white data-[state=open]:bg-green-600 data-[state=open]:text-white",
                cn("min-h-8 justify-start py-1.5 text-left", wrapTitles ? "h-auto whitespace-normal" : "h-8 whitespace-nowrap"),
                index === activeIndex ? "text-green-700" : "text-stone-500"
              )}
              style={{ paddingLeft: 8 + (heading.level - 1) * 10 }}
            >
              <span
                style={{ color: index === activeIndex ? undefined : heading.color }}
                className={cn("min-w-0 group-hover:!text-white group-data-[state=open]:!text-white", wrapTitles ? "break-words" : "truncate")}
              >
                {heading.text}
              </span>
            </Button></SectionPreview>
          ))}
          {!headings.length && expanded && <p className="px-2 py-3 text-xs text-stone-400">暂无标题</p>}
        </ScrollArea>
      </div>
    </aside>
  )
}
