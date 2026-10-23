import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseFootnotes } from "@vessel/obsidian"
import { SectionPreview } from "@/components/core/canvas/variants/markdown/section-preview"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AlignLeft, ChevronRight, ListTree, Menu, Subscript, PanelRight, Pin, PinOff, WrapText } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

/** 固定时展示标题，取消固定后用静态横线展示标题层级和当前阅读位置。 */
export function DocumentOutline({
  headings,
  activeIndex,
  onSelect,
  fileName,
  sections = [],
  workspacePath,
  documentPath,
  source = "",
  onSelectFootnote
}: {
  headings: { text: string; level: number; color?: string }[]
  activeIndex: number
  onSelect: (index: number) => void
  fileName?: string
  sections?: string[]
  workspacePath: string
  documentPath: string
  source?: string
  onSelectFootnote?: (id: string) => void
}) {
  const [toolsOpen, setToolsOpen] = useState(false)
  const [toolsHovered, setToolsHovered] = useState(false)
  const [section, setSection] = useState<"outline" | "footnotes">("outline")
  const notes = useMemo(() => {
    const parsed = parseFootnotes(source)
    return parsed.definitions.map((note, index) => ({
      ...note,
      number: index + 1,
      text: parsed.annotations.filter((annotation) => annotation.id === note.id).map((annotation) => annotation.content).join("") || note.content
    }))
  }, [source])
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())
  const tree = useMemo(() => {
    const stack: number[] = []
    const nodes = headings.map((heading, index) => {
      while (stack.length && headings[stack[stack.length - 1]].level >= heading.level) stack.pop()
      const ancestors = [...stack]
      stack.push(index)
      return { ancestors, depth: ancestors.length, descendants: 0 }
    })
    nodes.forEach((node) => node.ancestors.forEach((parent) => nodes[parent].descendants++))
    return nodes
  }, [headings])
  useEffect(() => setCollapsed(new Set()), [documentPath])
  const anyExpanded = tree.some((node, index) => node.descendants > 0 && !collapsed.has(index))
  const [wrapTitles, setWrapTitles] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const expanded = pinned || (!toolsOpen && (hovered || previewIndex !== null))
  return (
    <aside
      aria-label="文档大纲"
      onMouseLeave={() => {
        if (toolsOpen) return
        closeTimer.current = setTimeout(() => setHovered(false), 80)
      }}
      onFocus={(event) => {
        if (!(event.target as Element).closest("[data-outline-tools]")) setHovered(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false)
      }}
      className={cn("relative z-20 flex min-h-0 shrink-0 flex-col py-2 transition-[width]", pinned ? "w-48 px-2" : "relative w-12 px-1")}
    >
      <div className="absolute right-1 top-2 z-30" data-outline-tools>
        <Popover open={toolsOpen} onOpenChange={(open) => { setToolsOpen(open); if (!open) setToolsHovered(false); if (open) setHovered(false) }}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="document-outline-tool size-7 text-stone-400 hover:bg-green-600 hover:text-white" aria-label="右侧栏目" data-title="右侧栏目" data-menu-hovered={toolsHovered} data-menu-open={toolsOpen}>
              <PanelRight className="!size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="left" align="center" sideOffset={12} avoidCollisions={false} onOpenAutoFocus={(event) => event.preventDefault()} className="document-outline-tools-popover flex w-auto items-center gap-0.5 rounded-lg p-1" data-outline-tools onMouseEnter={(event) => { event.stopPropagation(); clearTimeout(closeTimer.current); setToolsHovered(true) }} onMouseLeave={() => setToolsHovered(false)} onFocusCapture={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onCloseAutoFocus={(event) => event.preventDefault()}>
            {([ ["outline", Menu, "目录"], ["footnotes", Subscript, "脚注"] ] as const).map(([value, Icon, label]) => (
              <Button key={value} variant="ghost" size="icon" aria-label={label} data-title={label} className={cn("document-outline-tool size-6 rounded-md hover:bg-green-600 hover:text-white", section === value && pinned && "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400")} onClick={() => { setSection(value); setPinned(true); setToolsOpen(false) }}><Icon className="!size-3.5" /></Button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      {!pinned && (
        <div
          aria-hidden={expanded}
          inert={expanded}
          className="flex min-h-0 flex-1 flex-col bg-transparent"
        >
          <div className="h-8 flex justify-end">

          </div>
          <ScrollArea
            data-outline-preview-trigger
            className="min-h-0 flex-1"
            onMouseEnter={() => {
              clearTimeout(closeTimer.current)
              setSection("outline")
              setHovered(true)
            }}
          >
            {headings.map((heading, index) => (
              <button
                key={index}
                aria-label={heading.text}
                aria-current={index === activeIndex ? "location" : undefined}
                onClick={() => onSelect(index)}
                data-heading-level={heading.level}
                className="document-outline-bar-row flex h-4 w-full items-center justify-end bg-transparent px-1"
              >
                <Skeleton
                  aria-hidden="true"
                  className={cn("document-outline-bar h-[3px] animate-none rounded-full", index === activeIndex ? "bg-green-600" : "bg-stone-300")}
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
        onMouseEnter={() => { clearTimeout(closeTimer.current); setHovered(true) }}
        style={{ transition: "transform 400ms cubic-bezier(0.22,1,0.36,1), opacity 250ms ease", transform: expanded ? "translateX(0)" : "translateX(24px)", opacity: expanded ? 1 : 0 }}
        className={cn("document-outline-panel flex min-h-0 flex-1 flex-col overflow-hidden motion-reduce:!transition-none", pinned ? "w-full" : "absolute inset-y-0 right-0 z-20", !pinned && "w-48 rounded-lg bg-white p-2 shadow-lg ring-1 ring-stone-100")}
      >
        <div className="flex h-8 shrink-0 items-center justify-end gap-2 pr-7">
          <Button
            variant="ghost"
            size="icon"
            className="document-outline-action size-7 shrink-0 text-stone-400 hover:bg-green-600 hover:text-white active:bg-green-600 active:text-white"
            aria-label={anyExpanded ? "折叠全部标题" : "展开全部标题"}
            data-title={anyExpanded ? "折叠全部标题" : "展开全部标题"}
            disabled={!tree.some((node) => node.descendants > 0)}
            onClick={() => setCollapsed(anyExpanded ? new Set(tree.flatMap((node, index) => node.descendants ? [index] : [])) : new Set())}
          >
            <ListTree className="!size-3.5" />
          </Button>
          {
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-stone-400 hover:bg-green-600 hover:text-white"
              aria-label={wrapTitles ? "标题改为单行显示" : "标题改为换行显示"}
              data-title={wrapTitles ? "标题改为单行显示" : "标题改为换行显示"}
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
            data-title={pinned ? "取消固定大纲" : "固定大纲"}
            aria-label={pinned ? "取消固定大纲" : "固定大纲"}
            aria-pressed={pinned}
            onClick={() => setPinned(!pinned)}
          >
            {pinned ? <PinOff className="!size-3.5" /> : <Pin className="!size-3.5" />}
          </Button>
        </div>
        {fileName && (
          <div data-title={fileName} className="shrink-0 break-words px-2 pb-2 pt-1 text-xs font-semibold leading-5 text-stone-700 dark:text-stone-200">
            {fileName}
          </div>
        )}
        <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
          {section === "footnotes" && <div className="space-y-1 px-1 py-2">
            {notes.map((note) => <button key={note.id} className="w-full rounded-md p-2 text-left text-xs text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/5" onClick={() => onSelectFootnote?.(note.id)}><span className="flex items-start gap-1.5"><span aria-label={`第 ${note.number} 个脚注`} className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-green-50 font-mono text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-400">{note.number}</span><span className="min-w-0 break-words font-medium leading-5">{note.text}</span></span>{note.text !== note.content && <span className="mt-1 block whitespace-pre-wrap break-words pl-[22px] text-[11px] leading-5 text-stone-400">{note.content}</span>}</button>)}
            {!notes.length && <p className="p-2 text-xs text-stone-400">暂无脚注</p>}
          </div>}
          {section === "outline" && headings.map((heading, index) => {
            const node = tree[index]
            if (node.ancestors.some((parent) => collapsed.has(parent))) return null
            const folded = collapsed.has(index)
            return (
              <div
                key={index}
                className="document-outline-heading group flex min-h-7 w-full items-center rounded-md pr-1 text-stone-600 hover:bg-stone-100 aria-[current=location]:bg-green-50 aria-[current=location]:text-green-700"
                aria-current={index === activeIndex ? "location" : undefined}
                style={{ paddingLeft: 8 + (heading.level - 1) * 10 }}
              >
                {node.descendants > 0 ? (
                  <button
                    type="button"
                    className="document-outline-fold flex h-6 w-4 shrink-0 items-center justify-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-600"
                    aria-label={`${folded ? "展开" : "折叠"}${heading.text}`}
                    aria-expanded={!folded}
                    onClick={() => setCollapsed((current) => {
                      const next = new Set(current)
                      if (next.has(index)) next.delete(index)
                      else next.add(index)
                      return next
                    })}
                  >
                    <ChevronRight className={cn("size-3.5 transition-transform duration-150 motion-reduce:transition-none", !folded && "rotate-90")} />
                  </button>
                ) : <span aria-hidden className="flex w-4 shrink-0 justify-center"><span className="size-1 rounded-full bg-stone-300" /></span>}
                <SectionPreview
                  enabled={expanded}
                  onOpenChange={(open) => setPreviewIndex((current) => (open ? index : current === index ? null : current))}
                  workspacePath={workspacePath}
                  documentPath={documentPath}
                  source={sections[index] || heading.text}
                >
                  <button
                    type="button"
                    aria-label={heading.text}
                    aria-current={index === activeIndex ? "location" : undefined}
                    onClick={() => onSelect(index)}
                    className={cn("flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[11px]", wrapTitles ? "whitespace-normal" : "whitespace-nowrap", index === activeIndex && "font-semibold")}
                  >
                    <span aria-hidden data-level={heading.level} className="document-outline-level flex h-[15px] w-[21px] shrink-0 items-center justify-center rounded-[3px] bg-stone-100 font-mono text-[8.5px] font-bold text-stone-400 data-[level=1]:bg-green-100 data-[level=1]:text-green-700 data-[level=2]:bg-stone-200 data-[level=2]:text-stone-600">H{heading.level}</span>
                    <span style={{ color: index === activeIndex ? undefined : heading.color }} className={cn("min-w-0", wrapTitles ? "break-words" : "truncate")}>
                      {heading.text}
                    </span>
                    {folded && node.descendants > 0 && <span aria-label={`${node.descendants} 个子标题`} className="document-outline-count ml-auto shrink-0 rounded-full bg-stone-100 px-1.5 text-[10px] font-normal text-stone-400">{node.descendants}</span>}
                  </button>
                </SectionPreview>
              </div>
            )
          })}
          {section === "outline" && !headings.length && expanded && <p className="px-2 py-3 text-xs text-stone-400">暂无标题</p>}
        </ScrollArea>
      </div>
    </aside>
  )
}
