import type { VirtualTreeRow } from "./tree-shared"

/** Build parent links and inclusive subtree ranges once per visible tree change. */
export function stickyTreeModel<T>(rows: readonly VirtualTreeRow<T>[]) {
  const parents: number[] = [], ends = rows.map((_, index) => index), stack: number[] = []
  rows.forEach((row, index) => {
    while (stack.length && rows[stack[stack.length - 1]].depth >= row.depth) ends[stack.pop()!] = index - 1
    parents[index] = stack.at(-1) ?? -1
    stack.push(index)
  })
  while (stack.length) ends[stack.pop()!] = rows.length - 1
  return { parents, ends }
}

export interface StickyTreeEntry { index: number; top: number }

/** Examine only the ancestors at each uncovered viewport boundary, not all rows. */
export function stickyTreeEntries<T>(rows: readonly VirtualTreeRow<T>[], model: ReturnType<typeof stickyTreeModel>, scrollTop: number, viewportHeight: number, rowHeight: number, rowGap = 0): StickyTreeEntry[] {
  if (scrollTop <= 0 || !rows.length || viewportHeight <= 0) return []
  const stride = rowHeight + Math.max(0, rowGap)
  const limit = Math.min(7, Math.floor(viewportHeight * .4 / stride))
  const entries: StickyTreeEntry[] = []
  let previous = -1
  for (let slot = 0; slot < limit; slot++) {
    const boundary = slot * stride
    const first = Math.min(rows.length - 1, Math.floor((scrollTop + boundary) / stride))
    let candidate = first
    while (model.parents[candidate] !== previous && model.parents[candidate] >= 0) candidate = model.parents[candidate]
    if (model.parents[candidate] !== previous || !rows[candidate].expanded || model.ends[candidate] <= candidate || candidate * stride >= scrollTop + boundary) break
    const endBottom = (model.ends[candidate] + 1) * stride - rowGap - scrollTop
    if (endBottom <= boundary) break
    entries.push({ index: candidate, top: Math.min(boundary, endBottom - rowHeight) })
    previous = candidate
  }
  return entries
}
