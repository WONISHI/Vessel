import { ScrollArea } from "@/components/ui/scroll-area"
import { useRef, useState } from "react"
import { Bookmark, Globe, History, Search, Trash2, X } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import type { HistoryEntry } from "../../../../shared/browser-tools"

function SiteIcon({ entry }: { entry: HistoryEntry }) {
  const fallback = new URL('/favicon.ico', entry.url).href
  const [source, setSource] = useState(entry.favicon || fallback)
  return <span className="relative flex size-5 shrink-0 items-center justify-center rounded bg-green-50 text-green-600"><Globe size={14} />{source && <img src={source} alt="" className="absolute size-4 bg-green-50 object-contain" onError={() => setSource(source === fallback ? '' : fallback)} />}</span>
}
function groupHistory(entries: HistoryEntry[], query: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const groups = new Map<string, HistoryEntry[]>()
  for (const entry of entries) {
    if (!`${entry.title} ${entry.url}`.toLowerCase().includes(query.trim().toLowerCase())) continue
    const date = new Date(entry.visitedAt)
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const label = day === +today ? '今天' : day === +yesterday ? '昨天' : `${date.getFullYear() === now.getFullYear() ? '' : date.getFullYear() + '年'}${date.getMonth() + 1}月${date.getDate()}日`
    groups.set(label, [...(groups.get(label) || []), entry])
  }
  return [...groups]
}
export function HistorySheet({ open, onOpenChange, entries, error, onDelete, onNavigate }: { open: boolean; onOpenChange: (open: boolean) => void; entries: HistoryEntry[]; error: string; onDelete: (id: number | null) => void; onNavigate: (url: string) => void }) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const groups = groupHistory(entries, query)
  const actionClass = "flex size-7 shrink-0 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30"
  return <Sheet open={open} onOpenChange={onOpenChange} modal={false}><SheetContent showOverlay={false} showCloseButton={false} onInteractOutside={event => event.preventDefault()} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); input.current?.focus() } }} className="z-[250] inset-y-3 right-3 flex h-auto w-[360px] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-0 shadow-xl sm:max-w-[360px]">
    <div className="shrink-0 border-b border-stone-100 px-3.5 pb-2.5 pt-3.5">
      <div className="mb-3 flex items-center gap-2"><History size={16} className="text-green-600" /><SheetTitle className="text-sm font-semibold">浏览历史</SheetTitle><span className="rounded-full bg-stone-100 px-1.5 text-[11px] font-semibold text-stone-500">{entries.length}</span><div className="ml-auto flex gap-1"><button className={actionClass} aria-label="清空历史记录" disabled={!entries.length} onClick={() => onDelete(null)}><Trash2 size={14} /></button><button className={actionClass} aria-label="关闭浏览历史" onClick={() => onOpenChange(false)}><X size={16} /></button></div></div>
      <SheetDescription className="sr-only">仅保留最近 30 天的浏览记录，支持搜索和删除。</SheetDescription>
      <div className="flex h-8 items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-2 focus-within:border-green-600"><Search size={14} className="text-stone-400" /><input ref={input} value={query} onChange={event => setQuery(event.target.value)} aria-label="搜索历史记录" placeholder="搜索历史记录…" className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none placeholder:text-stone-400" /><kbd className="rounded border bg-white px-1 text-[10px] text-stone-400">⌘F</kbd></div>
    </div>
    {error && <p role="alert" className="px-3.5 py-2 text-xs text-red-600">{error}</p>}
    <ScrollArea className="min-h-0 min-w-0 flex-1 py-1 [&_[data-radix-scroll-area-viewport]>div]:!block" type="auto">{!groups.length && <p className="p-5 text-center text-xs text-stone-400">{query ? '没有匹配的浏览记录' : '暂无浏览记录'}</p>}{groups.map(([label, rows]) => <section key={label}><div className="sticky top-0 z-10 flex items-center gap-2 bg-white px-3.5 pb-1 pt-2 text-[11px] font-semibold text-stone-400">{label}<span className="h-px flex-1 bg-stone-100" /></div>{rows.map(entry => <div key={entry.id} className="group flex min-w-0 max-w-full items-center gap-2 px-3.5 py-1.5 hover:bg-stone-50"><SiteIcon key={`${entry.id}-${entry.favicon}`} entry={entry} /><button className="min-w-0 flex-1 text-left" onClick={() => { onNavigate(entry.url); onOpenChange(false) }}><span className="block truncate text-xs font-medium text-stone-800">{entry.title || entry.url}</span><span className="block truncate font-mono text-[11px] text-stone-400">{entry.url.replace(/^https?:\/\//, '')}</span></button>{!!entry.bookmarked && <Bookmark aria-label="已收藏" size={12} className="shrink-0 text-green-600" />}<time className="text-[10px] tabular-nums text-stone-300 group-hover:hidden group-focus-within:hidden">{new Date(entry.visitedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</time><button aria-label={`删除记录 ${entry.title}`} className="hidden size-7 shrink-0 items-center justify-center rounded text-stone-400 hover:bg-red-50 hover:text-red-600 group-hover:flex group-focus-within:flex focus:flex" onClick={() => onDelete(entry.id)}><Trash2 size={13} /></button></div>)}</section>)}</ScrollArea>
  </SheetContent></Sheet>
}
