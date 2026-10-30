import type { VirtualTreeProps } from "@/components/ui/tree/components/tree-shared"
import { VirtualTreeItem } from "@/components/ui/tree/components/virtual-tree-item"
import { virtualRangeNeedsUpdate, virtualTreeRange } from "@/components/ui/tree/components/virtual-range"
import { useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

/** Renders buffered rows synchronously at scroll boundaries to avoid fast-scroll gaps. */
export function VirtualTree<T>({ rows, viewport, indent = 12, rowHeight = 32, overscan = 6, selectedId, renderRow }: VirtualTreeProps<T>) {
  const [range, setRange] = useState(() => virtualTreeRange(viewport?.scrollTop || 0, viewport?.clientHeight || 0, rows.length, rowHeight, overscan))
  const current = useRef(range)
  useLayoutEffect(() => {
    if (!viewport) return
    /** Computes a fresh buffer for layout changes and large scrollbar jumps. */
    const update = (synchronous: boolean) => {
      const next = virtualTreeRange(viewport.scrollTop, viewport.clientHeight, rows.length, rowHeight, overscan)
      if (next.start === current.current.start && next.end === current.current.end) return
      current.current = next
      if (synchronous) flushSync(() => setRange(next))
      else setRange(next)
    }
    /** Refills only near a rendered edge, committing before the browser's next paint. */
    const scroll = () => {
      if (virtualRangeNeedsUpdate(current.current, viewport.scrollTop, viewport.clientHeight, rows.length, rowHeight, Math.max(1, overscan))) update(true)
    }
    const reveal = () => update(false)
    viewport.addEventListener("vessel:tree-reveal", reveal)
    const observer = new ResizeObserver(() => update(false))
    observer.observe(viewport)
    viewport.addEventListener("scroll", scroll, { passive: true })
    update(false)
    return () => { viewport.removeEventListener("vessel:tree-reveal", reveal); observer.disconnect(); viewport.removeEventListener("scroll", scroll) }
  }, [viewport, rows.length, rowHeight, overscan])
  const start = Math.min(range.start, Math.max(0, rows.length - 1))
  const end = Math.min(rows.length, Math.max(start + 1, range.end))
  return (
    <div role="tree" aria-label="工作区文件树" className="relative w-full" style={{ height: rows.length * rowHeight }}>
      {rows.slice(start, end).map((row, index) => (
        <VirtualTreeItem key={row.id} row={row} index={start + index} rowHeight={rowHeight} indent={Number.isFinite(indent) ? Math.max(0, indent) : 12} selected={row.id === selectedId} renderRow={renderRow} />
      ))}
    </div>
  )
}
