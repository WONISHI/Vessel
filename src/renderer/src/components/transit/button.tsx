import { useEffect, useRef, useState } from "react"
import { Pin, Globe, FileText, Trash2, ClipboardPaste } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { addTransit, addTransitFile, deleteTransit, selectTransit, useTransit } from "./state"
export function TransitButton() {
  const { items, selected } = useTransit()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const enter = () => { clearTimeout(timer.current); setOpen(true) }
  const leave = () => { timer.current = setTimeout(() => setOpen(false), 250) }
  useEffect(() => () => clearTimeout(timer.current), [])
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={`中转站，${items.length} 个`} onMouseEnter={enter} onMouseLeave={leave} className={`relative size-[38px] rounded-[10px] hover:!bg-[#f0efed] hover:!text-stone-500 ${selected ? "!bg-emerald-50 !text-green-700" : "text-stone-500"}`}><Pin className="!size-5" />{items.length > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-emerald-700 px-1 text-[9px] leading-4 !text-white">{items.length}</span>}</Button></PopoverTrigger>
    <PopoverContent side="right" sideOffset={10} onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()} onMouseEnter={enter} onMouseLeave={leave} className="z-[60] w-[280px] overflow-hidden rounded-xl border-stone-200 bg-white p-0 text-stone-800 shadow-xl">
      <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold"><Pin className="size-4 text-green-600" />中转站<span className="ml-auto rounded-full bg-stone-100 px-2 text-xs font-normal text-stone-400">{items.length} 个</span></div>
      <div className="max-h-[280px] overflow-auto p-1">
        {!items.length && <p className="px-3 py-6 text-center text-xs text-stone-400">暂无内容，读取剪贴板添加链接或文字</p>}
        {items.map(item => <div key={item.id} className={`group flex items-center gap-2 rounded-lg p-2 ${selected === item.id ? "bg-emerald-50" : "hover:bg-stone-50"}`}>
          <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { selectTransit(item.id); setOpen(false) }}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">{item.kind === "url" ? <Globe className="size-4" /> : <FileText className="size-4 text-blue-600" />}</span>
            <span className="min-w-0"><span className="block truncate text-xs font-semibold">{item.title}</span><span className="block truncate text-[11px] text-stone-400">{item.kind === "url" ? `${new URL(item.content).hostname} · 网页` : item.kind === "file" ? "工作区 · 文件" : "剪贴板 · 文本"}</span></span>
          </button>
          <button aria-label={`删除 ${item.title}`} title="删除" className="rounded p-1 text-stone-400 opacity-0 hover:bg-stone-200 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100" onClick={() => { try { deleteTransit(item.id) } catch { toast.error("删除失败，无法保存列表") } }}><Trash2 className="size-3.5" /></button>
        </div>)}
      </div>
      <button className="flex w-full items-center gap-2 border-t px-3 py-2.5 text-xs text-stone-500 hover:bg-stone-50 hover:text-green-600" onClick={() => { void window.electronAPI.readTransitClipboard().then(value => { if (typeof value === "string") addTransit(value); else addTransitFile(value.root, value.path, value.title); setOpen(false) }).catch(error => toast.error(String(error))) }}><ClipboardPaste className="size-4" />读取剪贴板</button>
    </PopoverContent>
  </Popover>
}
