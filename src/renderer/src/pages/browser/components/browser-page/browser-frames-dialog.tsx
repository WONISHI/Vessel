import { useCallback, useEffect, useRef, useState } from "react"
import { ClipboardCopy, Copy, ExternalLink, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import type { BrowserFramesSnapshot } from "@vessel/type"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDialogLayout } from "@/features/layout/use-dialog-layout"
import { browserTabAction } from "@/pages/browser/tab-state"
import { isOpenableUrl } from "@/pages/browser/openable-url"

export default function BrowserFramesDialog({ guestId, pageURL, onClose }: { guestId: number; pageURL: string; onClose: () => void }) {
  const layout = useDialogLayout(true)
  const [snapshot, setSnapshot] = useState<BrowserFramesSnapshot>()
  const [selectedId, setSelectedId] = useState("")
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  const request = useRef(0)
  const selected = snapshot?.items.find(item => item.id === selectedId) || snapshot?.items[0]
  const load = useCallback(() => {
    const token = ++request.current
    return Promise.resolve().then(() => window.electronAPI.listBrowserFrames(guestId)).then(value => {
      if (token === request.current) setSnapshot(value)
    }).catch((reason: unknown) => {
      if (token === request.current) { setSnapshot(undefined); setError(reason instanceof Error ? reason.message : "读取 iframe 失败") }
    }).finally(() => { if (token === request.current) setBusy(false) })
  }, [guestId])
  useEffect(() => {
    void load()
    return () => { request.current++ }
  }, [load, pageURL])
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("已复制") }
    catch { toast.error("复制失败，请重试") }
  }
  const fields = selected ? [
    ["src", selected.src || (selected.srcdoc ? "未设置（使用 srcdoc）" : "未设置")],
    ["解析后地址", selected.srcdoc ? "about:srcdoc" : selected.resolvedSrc],
    ["所属页面", selected.documentURL], ["name", selected.name || "未设置"],
    ["id", selected.elementId || "未设置"], ["title", selected.title || "未设置"],
    ["嵌套层级", String(selected.depth + 1)], ["sandbox", selected.sandbox || "未设置或为空"]
  ] : []
  return <Dialog open modal={false} onOpenChange={open => { if (!open) onClose() }}>
    <DialogPortal><div aria-hidden="true" data-browser-frames-overlay style={layout.overlayStyle} className="fixed top-0 right-0 z-50 bg-black/[.04] backdrop-blur-[3px]" /></DialogPortal>
    <DialogContent style={layout.contentStyle} className="flex h-[min(75vh,640px)] max-w-4xl flex-col gap-3 text-foreground">
      <DialogHeader className="min-w-0 pr-6">
        <DialogTitle>查看域 <span className="ml-2 text-xs font-normal text-muted-foreground">{snapshot ? `${snapshot.unreadableDocuments || snapshot.truncated ? "至少 " : ""}${snapshot.total} 个 iframe` : ""}</span></DialogTitle>
        <DialogDescription title={pageURL} className="truncate text-xs">{pageURL}</DialogDescription>
      </DialogHeader>
      <div className="flex shrink-0 items-center justify-between gap-3 text-xs">
        <span className="min-w-0 text-muted-foreground">包含嵌套 iframe，选择一项查看详情。</span>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="icon" variant="outline" className="size-9 hover:!text-white [&:hover_svg]:!text-white" aria-label="复制 src" data-title="复制 src" disabled={!selected?.src} onClick={() => { if (selected) void copy(selected.src) }}><Copy className="size-3.5"/></Button>
          <Button size="icon" variant="outline" className="size-9 hover:!text-white [&:hover_svg]:!text-white" aria-label="新标签页查看" data-title="新标签页查看" disabled={!selected || selected.srcdoc || !isOpenableUrl(selected.resolvedSrc)} onClick={() => { if (selected) browserTabAction("new", undefined, selected.resolvedSrc) }}><ExternalLink className="size-3.5"/></Button>
          <Button size="icon" variant="outline" className="size-9 hover:!text-white [&:hover_svg]:!text-white" aria-label="复制全部信息" data-title="复制全部信息" disabled={!selected} onClick={() => void copy(fields.map(([label, value]) => `${label}: ${value}`).join("\n"))}><ClipboardCopy className="size-3.5"/></Button>
          <Button size="icon" variant="outline" className="size-9 hover:!text-white [&:hover_svg]:!text-white" aria-label="刷新" data-title="刷新" disabled={busy} onClick={() => { setBusy(true); setError(""); void load() }}><RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`}/></Button>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {busy && !snapshot ? <div role="status" className="grid min-h-0 flex-1 place-items-center text-xs text-muted-foreground">正在读取 iframe…</div> : snapshot && !snapshot.items.length ? <div className="grid min-h-0 flex-1 place-items-center text-xs text-muted-foreground">{snapshot.unreadableDocuments ? "未能获得 iframe 列表，请刷新后重试" : "当前页面未发现 iframe"}</div> : snapshot && <div className="flex min-h-0 flex-1 flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ScrollArea aria-label="iframe 列表区域" className="h-36 min-h-0 min-w-0 rounded-md border sm:h-full">
          <div role="group" aria-label="iframe 列表" className="space-y-1 p-1">
            {snapshot.items.map((item, index) => <button type="button" key={item.id} aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)} className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-muted aria-pressed:bg-muted">
              <span className="block truncate font-medium">{index + 1}. {item.title || item.name || item.elementId || "iframe"}</span>
              <span className="mt-1 block truncate text-[11px] text-muted-foreground">{item.srcdoc ? "srcdoc 内嵌页面" : item.resolvedSrc || "about:blank"}</span>
              <span className="mt-1 block text-[10px] text-muted-foreground">第 {item.depth + 1} 层</span>
            </button>)}
          </div>
        </ScrollArea>
        {selected && <ScrollArea aria-label="iframe 详情区域" className="min-h-0 min-w-0 flex-1 rounded-md border sm:h-full">
          <dl className="space-y-3 p-3 text-xs">{fields.map(([label, value]) => <div key={label}>
            <dt className="mb-1 text-[11px] text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap break-all font-mono select-text"><span>{value}</span>{(label === "解析后地址" || label === "所属页面") && <Button size="icon" variant="ghost" className="ml-1 size-6 align-middle hover:!text-white [&:hover_svg]:!text-white" aria-label={label === "解析后地址" ? "复制解析后地址" : "复制所属页面地址"} data-title={label === "解析后地址" ? "复制解析后地址" : "复制所属页面地址"} onClick={() => void copy(value)}><Copy className="size-3"/></Button>}</dd>
          </div>)}</dl>
        </ScrollArea>}
      </div>}
      {snapshot && (snapshot.unreadableDocuments > 0 || snapshot.truncated) && <p className="text-[11px] text-muted-foreground">{snapshot.unreadableDocuments > 0 ? `${snapshot.unreadableDocuments} 个文档未能读取，统计可能不完整。` : ""}{snapshot.truncated ? "列表较长，仅显示部分结果。" : ""}</p>}
    </DialogContent>
  </Dialog>
}
