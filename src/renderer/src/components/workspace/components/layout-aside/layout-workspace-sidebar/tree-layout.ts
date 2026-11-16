import type { CSSProperties } from "react"
import type { DirectoryTreeLayout } from "@/features/directory-tree/state"

/** Keep display, create and rename rows on the same disclosure/icon/text columns. */
export function fileTreeRowStyle(layout: DirectoryTreeLayout, editing = false): CSSProperties {
  return {
    height: layout.rowHeight, fontSize: layout.fontSize, lineHeight: `${layout.rowHeight}px`, fontFamily: layout.fontFamily,
    gap: layout.columnGap, paddingRight: layout.padding,
    paddingLeft: `calc(${layout.padding + (editing ? 12 + layout.columnGap : 0)}px + min(var(--tree-indent, 0px), max(0px, calc(100% - 140px))))`,
    "--tree-icon-size": `${layout.iconSize}px`
  } as CSSProperties
}
