import { useState } from "react"
import { Puzzle, PackagePlus, FolderPlus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import type { BrowserExtension } from "../../../../shared/browser-extensions"
export function BrowserExtensions() {
  const [items, setItems] = useState<BrowserExtension[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const run = async (operation: () => Promise<BrowserExtension[]>) => {
    setBusy(true); setError("")
    try { setItems(await operation()) } catch (reason) { setError(String(reason)) } finally { setBusy(false) }
  }
  return <Dialog onOpenChange={open => { if (open) void run(() => window.electronAPI.listBrowserExtensions()) }}>
    <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="管理浏览器扩展" title="管理浏览器扩展"><Puzzle /></Button></DialogTrigger>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>浏览器扩展</DialogTitle><DialogDescription>支持 CRX、ZIP（含 CRX 的压缩包）和包含 manifest.json 的解压目录。支持部分 Chrome 扩展和 DevTools 扩展，暂不支持从 Chrome 商店直接安装。</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void run(() => window.electronAPI.installBrowserExtension("archive"))}><PackagePlus />安装 CRX / ZIP 扩展包</Button>
        <Button variant="outline" disabled={busy} onClick={() => void run(() => window.electronAPI.installBrowserExtension("directory"))}><FolderPlus />加载解压目录</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="max-h-80 space-y-3 overflow-auto">
        {!items.length && <p className="py-6 text-center text-sm text-stone-400">{busy ? "正在读取扩展…" : "尚未安装扩展"}</p>}
        {items.map(item => <div key={item.key} className="rounded-lg border p-3">
          <div className="flex items-center gap-2"><Puzzle size={16} /><strong className="min-w-0 flex-1 truncate text-sm">{item.name}</strong><span className="text-xs text-stone-400">{item.version}</span>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => window.electronAPI.setBrowserExtensionEnabled(item.key, !item.enabled))}>{item.enabled ? "停用" : "启用"}</Button>
            <Button variant="ghost" size="icon" disabled={busy} aria-label={`移除 ${item.name}`} onClick={() => void run(() => window.electronAPI.removeBrowserExtension(item.key))}><Trash2 size={14} /></Button>
          </div><p className="mt-2 truncate text-xs text-stone-400" title={item.path}>{item.path}</p>
          {item.error && <p role="alert" className="mt-2 break-all text-xs text-red-600">加载失败：{item.error}</p>}
        </div>)}
      </div>
      <p className="text-xs text-stone-500">安装或启停后请刷新网页；DevTools 扩展需重新打开网页控制台。下次启动会自动恢复已启用的扩展。</p>
    </DialogContent>
  </Dialog>
}
