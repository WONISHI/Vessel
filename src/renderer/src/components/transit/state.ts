import { useSyncExternalStore } from "react"
export interface TransitItem { id: string; kind: "url" | "text" | "file"; root?: string; title: string; content: string }
const key = "vessel-transit-v1"
let items: TransitItem[] = []
try {
  const saved: unknown = JSON.parse(localStorage.getItem(key) || "[]")
  if (Array.isArray(saved)) items = saved.filter((x): x is TransitItem => x && typeof x.id === "string" && typeof x.title === "string" && typeof x.content === "string" && (x.kind === "text" || (x.kind === "file" && typeof x.root === "string") || (x.kind === "url" && /^https?:\/\//i.test(x.content))))
} catch { /* Start with an empty list if storage is invalid. */ }
let state = { items, selected: null as string | null }
const listeners = new Set<() => void>()
function update(next: typeof state) { state = next; listeners.forEach(fn => fn()) }
export function useTransit() { return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, () => state) }
export function selectTransit(id: string | null) { update({ ...state, selected: id }) }
function save(next: TransitItem[]) { localStorage.setItem(key, JSON.stringify(next)); update({ items: next, selected: next.some(i => i.id === state.selected) ? state.selected : null }) }
export function deleteTransit(id: string) { save(state.items.filter(i => i.id !== id)) }
export function addTransit(raw: string, title?: string) {
  const content = raw.trim()
  if (!content) throw new Error("剪贴板中没有文字或链接")
  if (content.length > 1_000_000) throw new Error("剪贴板内容过大，请缩短后重试")
  const existing = state.items.find(i => i.content === content)
  if (existing) { selectTransit(existing.id); return }
  let url: URL | undefined
  try { const parsed = new URL(content); if (["https:", "http:"].includes(parsed.protocol)) url = parsed } catch { /* Plain text. */ }
  const item: TransitItem = { id: crypto.randomUUID(), kind: url ? "url" : "text", title: title || (url ? url.hostname : content.split(/\r?\n/)[0].slice(0, 80)), content }
  save([...state.items, item]); selectTransit(item.id)
}

export function addTransitFile(root: string, path: string, title: string) {
  const existing = state.items.find(item => item.kind === "file" && item.content === path)
  if (existing) { selectTransit(existing.id); return }
  const item: TransitItem = { id: crypto.randomUUID(), kind: "file", root, content: path, title }
  save([...state.items, item]); selectTransit(item.id)
}
