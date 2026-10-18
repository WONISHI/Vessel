/** Returns the smallest scroll adjustment needed to fully reveal a fixed-height tree row. */
export function treeRevealScrollTop(index: number, scrollTop: number, viewportHeight: number, rowHeight = 32): number {
  const top = index * rowHeight
  const bottom = top + rowHeight
  if (top < scrollTop) return Math.max(0, top)
  if (bottom > scrollTop + viewportHeight) return Math.max(0, bottom - viewportHeight)
  return scrollTop
}
