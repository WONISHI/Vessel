import { memo, type CSSProperties } from "react"
import type { VirtualTreeProps, VirtualTreeRow } from "@/components/ui/tree/components/tree-shared"

/** Reuses unchanged tree rows while the surrounding virtual window moves. */
function VirtualTreeItemContent<T>({ row, index, rowHeight, rowGap, showGuides, guideOffset, indent, fullRow, selected, renderRow }: { row: VirtualTreeRow<T>; index: number; rowHeight: number; rowGap: number; showGuides: boolean; guideOffset: number; indent: number; fullRow: boolean; selected: boolean; renderRow: VirtualTreeProps<T>["renderRow"] }) {
  return (
    <div role="treeitem" aria-level={row.depth + 1} aria-expanded={row.expanded} aria-selected={selected} className="absolute left-0 top-0 w-full" style={{ height: rowHeight, transform: `translateY(${index * (rowHeight + rowGap)}px)`, paddingLeft: fullRow ? undefined : row.depth * indent, "--tree-indent": fullRow ? `${row.depth * indent}px` : undefined } as CSSProperties}>
      {fullRow && showGuides && row.depth > 0 && indent > 0 && <span data-tree-guides aria-hidden className="pointer-events-none absolute inset-y-0 z-[1] text-stone-400 opacity-25 dark:text-stone-500" style={{ left: guideOffset, top: -rowGap, width: `min(${row.depth * indent}px, max(0px, calc(100% - 140px)))`, backgroundImage: `repeating-linear-gradient(to right,currentColor 0 1px,transparent 1px ${indent}px)` }} />}
      {renderRow(row)}
    </div>
  )
}
export const VirtualTreeItem = memo(VirtualTreeItemContent) as typeof VirtualTreeItemContent
