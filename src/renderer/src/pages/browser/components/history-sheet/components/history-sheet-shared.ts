import type { HistoryEntry } from "@vessel/type"
export const PAGE_SIZE = 30

/** Performs the group history operation. */
export function groupHistory(entries: HistoryEntry[], query: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const groups = new Map<string, HistoryEntry[]>()
  const q = query.trim().toLowerCase()
  for (const entry of entries) {
    if (q && !`${entry.title} ${entry.url}`.toLowerCase().includes(q)) continue
    const date = new Date(entry.visitedAt)
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const label = day === +today ? "今天" : day === +yesterday ? "昨天" : `${date.getFullYear() === now.getFullYear() ? "" : date.getFullYear() + "年"}${date.getMonth() + 1}月${date.getDate()}日`
    groups.set(label, [...(groups.get(label) || []), entry])
  }
  return [...groups]
}
