import { VirtualTreeProps } from "@/components/ui/tree/components/tree-shared"
import React from "react"

/** Renders the virtual tree component. */
export function VirtualTree<T>({ rows, viewport, indent = 12, rowHeight = 32, overscan = 6, selectedId, renderRow }: VirtualTreeProps<T>) {
  const [windowState, setWindowState] = React.useState({ top: 0, height: 0 })
  React.useEffect(() => {
    if (!viewport) return

    /** Refreshes the current state. */
    const update = () => setWindowState({ top: viewport.scrollTop, height: viewport.clientHeight })
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    viewport.addEventListener("scroll", update, { passive: true })
    update()
    return () => {
      observer.disconnect()
      viewport.removeEventListener("scroll", update)
    }
  }, [viewport])
  const height = rows.length * rowHeight
  const top = Math.min(windowState.top, Math.max(0, height - windowState.height))
  const start = Math.max(0, Math.floor(top / rowHeight) - overscan)
  const end = Math.min(rows.length, Math.ceil((top + windowState.height) / rowHeight) + overscan)
  return (
    <div
      role="tree"
      aria-label="工作区文件树"
      className="relative w-full"
      style={{ height }}
    >
      {rows.slice(start, end).map((row, index) => (
        <div
          key={row.id}
          role="treeitem"
          aria-level={row.depth + 1}
          aria-expanded={row.expanded}
          aria-selected={row.id === selectedId}
          className="absolute left-0 top-0 w-full"
          style={{ height: rowHeight, transform: `translateY(${(start + index) * rowHeight}px)`, paddingLeft: row.depth * (Number.isFinite(indent) ? Math.max(0, indent) : 12) }}
        >
          {renderRow(row)}
        </div>
      ))}
    </div>
  )
}
