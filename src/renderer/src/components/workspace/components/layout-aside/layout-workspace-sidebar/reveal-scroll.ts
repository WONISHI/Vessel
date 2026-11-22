/** Returns the smallest scroll adjustment needed to fully reveal a fixed-height tree row. */
export function treeRevealScrollTop(index: number, scrollTop: number, viewportHeight: number, rowHeight = 32, rowGap = 0, topInset = 0): number {
  const top = index * (rowHeight + rowGap)
  const bottom = top + rowHeight
  if (top < scrollTop + topInset) return Math.max(0, top - topInset)
  if (bottom > scrollTop + viewportHeight) return Math.max(0, bottom - viewportHeight)
  return scrollTop
}
