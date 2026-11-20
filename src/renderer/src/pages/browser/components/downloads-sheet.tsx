import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { browserTabAction } from "@/pages/browser/tab-state"
import { browserFilePreview } from "../../../../../shared/browser-preview"
import type { BrowserDownloadEntry } from "@vessel/type"
import { Download, FolderOpen, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export function DownloadsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [entries, setEntries] = useState<BrowserDownloadEntry[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!open) return
    let alive = true
    const refresh = () => {
      setLoading(true)
      void window.electronAPI.listBrowserDownloads().then(items => {
        if (alive) { setEntries(items); setError("") }
      }).catch(error => { if (alive) setError(String(error)) }).finally(() => { if (alive) setLoading(false) })
    }
    refresh()
    const off = window.electronAPI.onBrowserDownloadsUpdated(refresh)
    return () => { alive = false; off() }
  }, [open])
  const preview = async (entry: BrowserDownloadEntry) => {
    try {
      const url = await window.electronAPI.previewBrowserDownload(entry.id)
      browserTabAction("new", undefined, url)
      onOpenChange(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)) }
  }
  const filtered = entries.filter(entry => `${entry.name} ${entry.path}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
    <SheetContent showOverlay={false} showCloseButton={false} onInteractOutside={event => event.preventDefault()} className="z-[250] inset-y-3 right-3 flex h-auto w-[380px] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden rounded-xl border bg-background p-0 text-foreground shadow-xl sm:max-w-[380px]">
      <div className="shrink-0 space-y-3 border-b p-3.5">
        <div className="flex items-center gap-2"><Download className="size-4 text-green-600" /><SheetTitle className="text-sm font-semibold">下载历史</SheetTitle><span className="text-xs text-muted-foreground">{entries.length}</span><button className="ml-auto rounded p-1 hover:bg-muted" aria-label="关闭下载历史" onClick={() => onOpenChange(false)}><X className="size-4" /></button></div>
        <SheetDescription className="text-xs">下载和保存成功的文件，点击文件名可预览支持的格式。</SheetDescription>
        <Input aria-label="搜索下载历史" placeholder="搜索文件名或路径…" value={query} onChange={event => setQuery(event.target.value)} className="h-8 text-xs" />
      </div>
      <ScrollArea className="min-h-0 flex-1" type="hover">
        <div className="space-y-1 p-2">
          {error && <p role="alert" className="p-3 text-xs text-red-500">{error}</p>}
          {loading && !entries.length && <p role="status" className="p-5 text-center text-xs text-muted-foreground">正在读取下载历史…</p>}
          {!loading && !filtered.length && !error && <p className="p-5 text-center text-xs text-muted-foreground">{query ? "没有匹配的文件" : "暂无下载历史"}</p>}
          {filtered.map(entry => {
            const file = browserFilePreview(entry.name)
            const supported = file && (!(file.kind === "audio" || file.kind === "video") || !!document.createElement(file.kind).canPlayType(file.mime))
            return <div key={entry.id} className="flex min-w-0 items-center gap-2 rounded-lg p-2 hover:bg-muted/60">
              <button className="min-w-0 flex-1 text-left disabled:cursor-default" disabled={!supported} onClick={() => void preview(entry)} title={entry.path}>
                <span className="block truncate text-xs font-medium">{entry.name}</span>
                <span className="mt-1 block truncate text-[10px] text-muted-foreground">{new Date(entry.savedAt).toLocaleString()} · {entry.size < 1024 ? `${entry.size} B` : `${(entry.size / 1024).toFixed(1)} KB`}{!supported && " · 此格式不支持预览"}</span>
                <span className="mt-1 block truncate text-[10px] text-muted-foreground">{entry.path}</span>
              </button>
              <button aria-label={`在文件管理器中显示 ${entry.name}`} data-title="在文件管理器中显示" className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted" onClick={() => { void window.electronAPI.revealBrowserDownload(entry.id).catch(error => toast.error(String(error))) }}><FolderOpen className="size-4" /></button>
            </div>
          })}
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
}
