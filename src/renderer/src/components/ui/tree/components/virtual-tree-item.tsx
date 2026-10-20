import { memo } from "react"
import type { VirtualTreeProps, VirtualTreeRow } from "@/components/ui/tree/components/tree-shared"

/** Reuses unchanged tree rows while the surrounding virtual window moves. */
function VirtualTreeItemContent<T>({ row, index, rowHeight, indent, selected, renderRow }: { row: VirtualTreeRow<T>; index: number; rowHeight: number; indent: number; selected: boolean; renderRow: VirtualTreeProps<T>["renderRow"] }) {
  return (
    <div role="treeitem" aria-level={row.depth + 1} aria-expanded={row.expanded} aria-selected={selected} className="absolute left-0 top-0 w-full" style={{ height: rowHeight, transform: `translateY(${index * rowHeight}px)`, paddingLeft: row.depth * indent }}>
      {renderRow(row)}
    </div>
  )
}
export const VirtualTreeItem = memo(VirtualTreeItemContent) as typeof VirtualTreeItemContent
