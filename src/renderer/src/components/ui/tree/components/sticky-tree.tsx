import { useLayoutEffect, useMemo, useRef, useState } from "react"
import type { VirtualTreeProps } from "./tree-shared"
import { VirtualTreeItem } from "./virtual-tree-item"
import { stickyTreeEntries, stickyTreeModel, type StickyTreeEntry } from "./sticky-tree-model"

/** Independent overlay: scrolling never changes the virtual list's height or data. */
export function StickyTree<T>({ rows, viewport, rowHeight = 32, rowGap = 0, indent = 12, guideOffset = 12, fullRow = false, showGuides = true, selectedId, renderRow }: VirtualTreeProps<T>) {
  const anchor = useRef<HTMLDivElement>(null)
  const model = useMemo(() => stickyTreeModel(rows), [rows])
  const [entries, setEntries] = useState<StickyTreeEntry[]>([])
  useLayoutEffect(() => {
    const element = anchor.current
    if (!viewport || !element) return
    // Measure the tree's origin before sticky positioning moves the anchor.
    const tree = element.parentElement!
    let origin = tree.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - viewport.clientTop
    const update = () => {
      const next = stickyTreeEntries(rows, model, viewport.scrollTop - origin, viewport.clientHeight, rowHeight, rowGap)
      setEntries((previous) => previous.length === next.length && previous.every((entry, index) => entry.index === next[index].index && entry.top === next[index].top) ? previous : next)
    }
    const resize = new ResizeObserver(() => {
      origin = tree.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - viewport.clientTop
      update()
    })
    resize.observe(viewport)
    viewport.addEventListener("scroll", update, { passive: true })
    viewport.addEventListener("vessel:tree-reveal", update)
    update()
    return () => { resize.disconnect(); viewport.removeEventListener("scroll", update); viewport.removeEventListener("vessel:tree-reveal", update) }
  }, [viewport, rows, model, rowHeight, rowGap])
  const height = entries.reduce((bottom, entry) => Math.max(bottom, entry.top + rowHeight), 0)
  return <div ref={anchor} className="pointer-events-none sticky top-0 z-20 h-0" data-tree-sticky-anchor>
    <div role="group" aria-label="置顶目录" className="absolute inset-x-0 top-0 overflow-hidden bg-white dark:bg-[#22272e]" style={{ height, boxShadow: height ? "0 3px 5px #0000000a" : undefined }}>
      {entries.map(({ index, top }, slot) => rows[index] && <div key={rows[index].id} data-tree-sticky-row={rows[index].id} className="pointer-events-auto absolute inset-x-0 border-b border-stone-200/60 bg-white dark:border-white/10 dark:bg-[#22272e]" style={{ top, height: rowHeight, zIndex: entries.length - slot }}>
        <VirtualTreeItem row={rows[index]} index={0} rowHeight={rowHeight} rowGap={0} indent={indent} fullRow={fullRow} showGuides={showGuides} guideOffset={guideOffset} selected={rows[index].id === selectedId} renderRow={renderRow} />
      </div>)}
    </div>
  </div>
}
