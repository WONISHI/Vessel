import type { VirtualTreeProps } from "@/components/ui/tree/components/tree-shared"
import { VirtualTreeItem } from "@/components/ui/tree/components/virtual-tree-item"
import { virtualRangeNeedsUpdate, virtualTreeRange } from "@/components/ui/tree/components/virtual-range"
import { useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { StickyTree } from "./sticky-tree"

/** Renders buffered rows synchronously at scroll boundaries to avoid fast-scroll gaps. */
export function VirtualTree<T>({ rows, viewport, indent = 12, rowHeight = 32, rowGap = 0, showGuides = true, guideOffset = 12, contentWidth, fullRow = false, overscan = 6, selectedId, selectedIds, renderRow, stickyScroll = false }: VirtualTreeProps<T>) {
  const stride = rowHeight + Math.max(0, rowGap)
  const [range, setRange] = useState(() => virtualTreeRange(viewport?.scrollTop || 0, viewport?.clientHeight || 0, rows.length, stride, overscan))
  const current = useRef(range)
  useLayoutEffect(() => {
    if (!viewport) return
    let committedTop = viewport.scrollTop
    let disposed = false, queued = false
    let frame: number | undefined
    const cancelFrame = () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = undefined
    }
    /** Computes a fresh buffer for layout changes and large scrollbar jumps. */
    const update = (synchronous: boolean, direction = 0, travel = 0) => {
      const next = virtualTreeRange(viewport.scrollTop, viewport.clientHeight, rows.length, stride, overscan, direction, travel)
      if (next.start === current.current.start && next.end === current.current.end) return
      current.current = next
      committedTop = viewport.scrollTop
      if (synchronous) flushSync(() => setRange(next))
      else setRange(next)
    }
    /** Batch buffer maintenance per frame; only a visible gap requires an immediate commit. */
    const scroll = () => {
      const travel = viewport.scrollTop - committedTop
      const guard = Math.max(overscan, Math.ceil(viewport.clientHeight / stride))
      if (virtualRangeNeedsUpdate(current.current, viewport.scrollTop, viewport.clientHeight, rows.length, stride, 0)) {
        cancelFrame()
        update(true, Math.sign(travel), travel)
      } else if (frame === undefined && virtualRangeNeedsUpdate(current.current, viewport.scrollTop, viewport.clientHeight, rows.length, stride, guard)) {
        frame = requestAnimationFrame(() => {
          frame = undefined
          if (disposed || !virtualRangeNeedsUpdate(current.current, viewport.scrollTop, viewport.clientHeight, rows.length, stride, guard)) return
          const latestTravel = viewport.scrollTop - committedTop
          update(true, Math.sign(latestTravel), latestTravel)
        })
      }
    }
    // Radix moves scrollTop during a thumb drag. Commit its new rows at the end
    // of that pointer event, before paint, rather than waiting for a scroll event.
    const area = viewport.closest('[data-vessel-scroll="area"]')
    const prepareDrag = (event: Event) => {
      const pointer = event as PointerEvent
      if (!(pointer.buttons & 1) || !(event.target instanceof Element) || !event.target.closest('[data-orientation="vertical"]') || queued) return
      queued = true
      queueMicrotask(() => {
        queued = false
        if (!disposed) scroll()
      })
    }
    area?.addEventListener("pointermove", prepareDrag)
    area?.addEventListener("pointerdown", prepareDrag)
    const reveal = () => { cancelFrame(); update(false) }
    viewport.addEventListener("vessel:tree-reveal", reveal)
    const observer = new ResizeObserver(() => update(false))
    observer.observe(viewport)
    viewport.addEventListener("scroll", scroll, { passive: true })
    update(false)
    return () => { disposed = true; cancelFrame(); area?.removeEventListener("pointermove", prepareDrag); area?.removeEventListener("pointerdown", prepareDrag); viewport.removeEventListener("vessel:tree-reveal", reveal); observer.disconnect(); viewport.removeEventListener("scroll", scroll) }
  }, [viewport, rows.length, stride, overscan])
  const start = Math.min(range.start, Math.max(0, rows.length - 1))
  const end = Math.min(rows.length, Math.max(start + 1, range.end))
  return (
    <div role="tree" aria-multiselectable={selectedIds ? true : undefined} aria-label="工作区文件树" className="relative w-full" style={{ height: Math.max(0, rows.length * stride - rowGap), minWidth: contentWidth, overflowAnchor: "none" }}>
      {stickyScroll && <StickyTree rows={rows} viewport={viewport} rowHeight={rowHeight} rowGap={rowGap} indent={indent} fullRow={fullRow} showGuides={showGuides} guideOffset={guideOffset} selectedId={selectedId} renderRow={renderRow} />}
      {rows.slice(start, end).map((row, index) => (
        <VirtualTreeItem key={row.id} row={row} index={start + index} rowHeight={rowHeight} rowGap={rowGap} showGuides={showGuides} guideOffset={guideOffset} indent={Number.isFinite(indent) ? Math.max(0, indent) : 12} fullRow={fullRow} selected={selectedIds ? selectedIds.includes(row.id) : row.id === selectedId} renderRow={renderRow} />
      ))}
    </div>
  )
}
