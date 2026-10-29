import { FilePreview } from "@/components/transit/file-preview"
import type { TransitItem } from "@/components/transit/state"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { ChevronLeft, ChevronRight, FileText } from "lucide-react"
import { useEffect, useState } from "react"
import "@/components/transit/panel/components/transit.css"

export default function StandalonePreview() {
  const [items, setItems] = useState<TransitItem[]>([])
  const [selected, setSelected] = useState("")
  const [error, setError] = useState("")
  const index = items.findIndex((item) => item.id === selected)
  const item = items[index]
  useEffect(() => {
    let updated = false
    let disposed = false
    const unsubscribe = window.electronAPI.onFilePreviewUpdated?.((state) => {
      updated = true
      setItems(state.items)
      setSelected(state.selected)
    })
    void Promise.all([window.electronAPI.getFilePreview(), window.electronAPI.getFilePreviewTabs?.()]).then(([initial, tabs]) => {
      if (disposed || updated) return
      setItems(tabs?.length ? tabs : [initial])
      setSelected(initial.id)
    }).catch((error) => { if (!disposed) setError(String(error)) })
    return () => { disposed = true; unsubscribe?.() }
  }, [])
  useEffect(() => {
    if (!item) return
    document.title = item.title
    void window.electronAPI.selectFilePreview?.(item.id)
  }, [item?.id, item?.title])
  return <TooltipProvider><div className="transit-sheet fixed inset-0 flex h-dvh w-screen flex-col overflow-hidden bg-white text-stone-800">
    <nav className="transit-bar transit-strip-bar" aria-label="预览文件标签">
      <button className="transit-bar-item" aria-label="上一个文件" disabled={index <= 0} onClick={() => setSelected(items[index - 1].id)}><ChevronLeft /></button>
      <div className="transit-strip-tabs" role="tablist">
        {items.map((tab) => <button key={tab.id} role="tab" aria-selected={tab.id === selected} aria-label={tab.title} data-title={tab.title} className={`transit-strip-tab ${tab.id === selected ? "active" : ""}`} onClick={() => setSelected(tab.id)}><FileText className="size-4" /></button>)}
      </div>
      <button className="transit-bar-item" aria-label="下一个文件" disabled={index < 0 || index >= items.length - 1} onClick={() => setSelected(items[index + 1].id)}><ChevronRight /></button>
      <span className="transit-strip-count">{Math.max(0, index + 1)}/{items.length}</span>
    </nav>
    <main className="flex min-h-0 flex-1 overflow-hidden">{error ? <p role="alert" className="p-5 text-red-600">{error}</p> : item ? <FilePreview key={item.id} item={item} /> : <p className="p-5 text-stone-400">正在读取文件…</p>}</main>
    <footer className="flex h-8 shrink-0 items-center gap-2 border-t bg-stone-50 px-3 text-xs text-stone-500"><FileText className="size-3.5" /><span className="truncate">{item?.title}</span><span className="ml-auto">独立预览</span></footer>
  </div><Toaster /></TooltipProvider>
}
