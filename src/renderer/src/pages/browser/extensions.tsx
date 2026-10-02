import { useEffect, useState } from "react"
import { Puzzle, Upload, Folder, Trash2, Box, TriangleAlert, Pin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import type { BrowserExtension } from "../../../../shared/browser-extensions"
const Icon = ({ item }: { item: BrowserExtension }) => item.icon ? <img src={item.icon} alt="" className="size-4 object-contain" /> : <Puzzle className="size-4" />
export function BrowserExtensions({ onOpenDevtools }: { onOpenDevtools?: () => void }) {
  const [items, setItems] = useState<BrowserExtension[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [menu, setMenu] = useState<BrowserExtension | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [permissions, setPermissions] = useState<BrowserExtension | null>(null)
  const run = async (operation: () => Promise<BrowserExtension[]>) => {
    setBusy(true); setError("")
    try { setItems(await operation()) } catch (reason) { setError(String(reason)); setOpen(true) } finally { setBusy(false) }
  }
  useEffect(() => {
    let active = true
    void window.electronAPI.listBrowserExtensions().then(items => { if (active) setItems(items) }, reason => { if (active) setError(String(reason)) })
    return () => { active = false }
  }, [])
  const launch = async (item: BrowserExtension, mode: "open" | "options" | "inspect" = "open") => {
    setError("")
    try {
      const result = await window.electronAPI.openBrowserExtension(item.key, mode)
      if (result.kind === "devtools") { onOpenDevtools?.(); setOpen(false) }
      if (result.message) { setError(result.message); setOpen(true) }
    } catch (reason) { setError(String(reason)); setOpen(true) }
  }
  const context = (event: React.MouseEvent, item: BrowserExtension) => { event.preventDefault(); setPosition({ x: event.clientX, y: event.clientY }); setMenu(item) }
  return <>
    {items.filter(item => item.pinned && item.enabled).map(item => <Button key={item.key} className="browser-extension-button" variant="ghost" size="icon" title={item.name} aria-label={`打开 ${item.name}`} onClick={() => void launch(item)} onContextMenu={event => context(event, item)}><Icon item={item} /></Button>)}
    <Button variant="ghost" size="icon" aria-label="管理浏览器扩展" title="管理浏览器扩展" onClick={() => { setOpen(!open); void run(() => window.electronAPI.listBrowserExtensions()) }}><Puzzle /></Button>
    <Sheet modal={false} open={open} onOpenChange={setOpen}>
      <SheetContent showOverlay={false} className="flex w-[380px] max-w-[100vw] flex-col gap-0 p-0 text-xs sm:max-w-[380px]" onInteractOutside={event => event.preventDefault()}>
        <SheetHeader className="border-b px-5 py-4 text-left"><SheetTitle className="text-base flex items-center gap-2"><Box className="size-5 text-green-600" />浏览器扩展</SheetTitle><SheetDescription className="pr-4 text-xs leading-5">支持 CRX、ZIP（含 CRX 的压缩包）和包含 manifest.json 的解压目录。支持部分 Chrome 扩展和 DevTools 扩展，暂不支持从 Chrome 商店直接安装。</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="mb-4 grid grid-cols-2 gap-2"><Button className="h-9 px-2 text-xs bg-green-600 text-white hover:bg-green-700" disabled={busy} onClick={() => void run(() => window.electronAPI.installBrowserExtension("archive"))}><Upload />安装 CRX / ZIP</Button><Button className="h-9 px-2 text-xs hover:bg-[#327f73] hover:text-white active:bg-[#327f73] active:text-white" variant="outline" disabled={busy} onClick={() => void run(() => window.electronAPI.installBrowserExtension("directory"))}><Folder />加载解压目录</Button></div>
          {error && <p role="status" className="mb-4 text-sm text-amber-700">{error}</p>}
          <div className="mb-3 flex justify-between text-xs text-muted-foreground"><span>已安装扩展</span><span className="rounded-full bg-muted px-2">{items.length}</span></div>
          {!items.length && <p className="py-8 text-center text-sm text-muted-foreground">{busy ? "正在读取扩展…" : "尚未安装扩展"}</p>}
          <div className="space-y-3">{items.map(item => <div key={item.key} onContextMenu={event => context(event, item)} className={`rounded-xl border bg-muted/20 p-3 ${item.enabled ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-3"><button disabled={!item.enabled || busy} aria-label={`打开 ${item.name}`} onClick={() => void launch(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-green-600"><Icon item={item} /></span><span className="min-w-0"><span className="flex items-center gap-2"><strong className="truncate text-xs">{item.name}</strong><span className="rounded border bg-background px-1 text-[10px] text-muted-foreground">{item.version}</span></span><span className="block truncate text-xs text-muted-foreground" title={item.path}>{item.path}</span></span></button>
              <Switch aria-label={`启用 ${item.name}`} checked={item.enabled} disabled={busy} onCheckedChange={enabled => void run(() => window.electronAPI.setBrowserExtensionEnabled(item.key, enabled))} />
              <button disabled={busy} aria-label={`移除 ${item.name}`} className="text-muted-foreground hover:text-red-600" onClick={() => void run(() => window.electronAPI.removeBrowserExtension(item.key))}><Trash2 size={16} /></button>
            </div>
            <button disabled={busy} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground" onClick={() => void run(() => window.electronAPI.pinBrowserExtension(item.key, !item.pinned))}><Pin size={12} />{item.pinned ? "取消固定" : "固定到工具栏"}</button>
            {item.error && <p className="mt-2 break-all text-xs text-red-600">加载失败：{item.error}</p>}
          </div>)}</div>
          {permissions && <section className="mt-4 rounded-lg border p-3 text-sm"><div className="flex justify-between"><strong>{permissions.name} 声明的权限</strong><button onClick={() => setPermissions(null)}>关闭</button></div><ul className="mt-2 break-all text-xs text-muted-foreground">{permissions.permissions?.map(p => <li key={p}>{p}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">此处展示扩展声明，不代表 Electron 支持全部权限；暂不支持按网站修改授权。</p></section>}
        </div>
        <footer className="flex gap-2 border-t bg-muted/20 px-5 py-3 text-[11px] leading-5 text-muted-foreground"><TriangleAlert className="mt-1 size-4 shrink-0 text-amber-600" />安装或启停后请刷新网页；DevTools 扩展需重新打开网页控制台。下次启动会自动恢复已启用的扩展。</footer>
      </SheetContent>
    </Sheet>
    <DropdownMenu modal={false} open={!!menu} onOpenChange={value => { if (!value) setMenu(null) }}><DropdownMenuTrigger className="fixed size-0" style={{ left: position.x, top: position.y }} aria-label="扩展菜单" /><DropdownMenuContent align="start" className="z-[60] w-64">
      <DropdownMenuLabel>{menu?.name}</DropdownMenuLabel><DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => { setPermissions(menu); setOpen(true) }}>可读取和更改的网站数据</DropdownMenuItem><DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => menu && void run(() => window.electronAPI.removeBrowserExtension(menu.key))}>从 Vessel 中移除</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => menu && void run(() => window.electronAPI.pinBrowserExtension(menu.key, !menu.pinned))}>{menu?.pinned ? "取消固定" : "固定到工具栏"}</DropdownMenuItem><DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => setOpen(true)}>管理扩展程序</DropdownMenuItem>
      <DropdownMenuItem disabled={!menu?.optionsPage} onSelect={() => menu && void launch(menu, "options")}>扩展选项</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => { setPermissions(menu); setOpen(true) }}>查看网站权限</DropdownMenuItem><DropdownMenuSeparator />
      <DropdownMenuItem disabled={!menu?.enabled || !menu.popup} onSelect={() => menu && void launch(menu, "inspect")}>审查弹出内容</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
  </>
}
