import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { virtualTreeRange, virtualRangeNeedsUpdate } from "@/components/ui/tree/components/virtual-range"

/** A fixed total scroll height; only the viewport and a small buffer mount rows. */
export function VirtualResults<T>({ items, viewport, renderRow, getKey }: { items: T[]; viewport: HTMLDivElement | null; renderRow: (item: T) => ReactNode; getKey: (item: T) => string }) {
  const [range, setRange] = useState(() => virtualTreeRange(0, 300, items.length, 30, 8))
  const current = useRef(range)
  // Only committed rows can satisfy a scroll event. A queued resize/index update
  // must not claim coverage while React is still displaying the previous range.
  useLayoutEffect(() => { current.current = range }, [range])
  useLayoutEffect(() => {
    if (!viewport) return
    const update = (sync = false) => {
      const next = virtualTreeRange(viewport.scrollTop, viewport.clientHeight || 300, items.length, 30, 8)
      if (next.start === current.current.start && next.end === current.current.end) return
      if (sync) flushSync(() => setRange(next))
      else setRange(next)
    }
    const scroll = () => {
      if (virtualRangeNeedsUpdate(current.current, viewport.scrollTop, viewport.clientHeight || 300, items.length, 30, 4)) update(true)
    }
    const reveal = () => update()
    const observer = new ResizeObserver(reveal)
    observer.observe(viewport)
    viewport.addEventListener("scroll", scroll, { passive: true })
    viewport.addEventListener("vessel:quick-picker-reveal", reveal)
    update()
    return () => { observer.disconnect(); viewport.removeEventListener("scroll", scroll); viewport.removeEventListener("vessel:quick-picker-reveal", reveal) }
  }, [items.length, viewport])
  const start = Math.min(range.start, Math.max(0, items.length - 1))
  const end = Math.min(items.length, Math.max(start + 1, range.end))
  return <div className="relative w-full" style={{ height: items.length * 30 }} data-virtual-quick-results>
    {items.slice(start, end).map((item, offset) => <div key={getKey(item)} className="absolute left-0 right-0 h-[30px]" style={{ top: (start + offset) * 30 }}>{renderRow(item)}</div>)}
  </div>
}
