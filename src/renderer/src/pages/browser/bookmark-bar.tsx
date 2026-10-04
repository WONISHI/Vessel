import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronsRight, Globe } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
export function BookmarkBar({ items, onNavigate }: { items: { url: string; title: string }[]; onNavigate: (url: string) => void }) {
  const container = useRef<HTMLDivElement>(null), measure = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(items.length), [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    const update = () => {
      const width = container.current?.clientWidth ?? 0
      const widths = Array.from(measure.current?.children ?? []).map(node => node.getBoundingClientRect().width + 8)
      const total = widths.reduce((sum, value) => sum + value, 0)
      let used = 0, visible = 0
      for (const value of widths) { if (used + value > width - 32 - (total > width - 32 ? 32 : 0)) break; used += value; visible++ }
      setCount(visible)
    }
    const observer = new ResizeObserver(update)
    if (container.current) observer.observe(container.current)
    update(); return () => observer.disconnect()
  }, [items])
  const button = (item: typeof items[number], hidden = false) => <button key={item.url} title={`${item.title}\n${item.url}`} tabIndex={hidden ? -1 : undefined} onClick={() => { onNavigate(item.url); setOpen(false) }} className="flex max-w-40 shrink-0 items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-stone-100"><Globe size={12} className="shrink-0" /><span className="truncate">{item.title}</span></button>
  return <div ref={container} className="browser-bookmarks relative min-w-0 overflow-hidden">
    <div ref={measure} aria-hidden className="pointer-events-none invisible absolute flex gap-2 whitespace-nowrap">{items.map(item => button(item, true))}</div>
    {items.slice(0,count).map(item => button(item))}
    {count < items.length && <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button className="ml-auto shrink-0" aria-label="其他书签"><ChevronsRight size={16} /></button></PopoverTrigger><PopoverContent align="end" className="z-[250] w-72 p-1"><ScrollArea className="max-h-80 [&_[data-radix-scroll-area-viewport]]:max-h-80">{items.slice(count).map(item => <div key={item.url}>{button(item)}</div>)}</ScrollArea></PopoverContent></Popover>}
  </div>
}
