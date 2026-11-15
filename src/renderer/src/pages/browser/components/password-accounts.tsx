import { useState } from "react"
import { Eye, EyeOff, Globe, KeyRound, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Entry = { id: string; origin: string; username: string; updated: number }
export function SiteLogo({ origin }: { origin: string }) {
  const [failed, setFailed] = useState(false)
  return <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-muted/40">
    {failed ? <Globe className="size-4 text-muted-foreground" /> : <img alt="" src={`${origin}/favicon.ico`} loading="lazy" referrerPolicy="no-referrer" className="size-4 object-contain" onError={() => setFailed(true)} />}
  </span>
}
const greenHover = "hover:!bg-green-600 hover:!text-white [&:hover_svg]:!text-white"
export function PasswordAccounts({ items, revealed, busy, onReveal, onDelete, onSettings, requiresUnlock }: {
  items: Entry[]; revealed: { id: string; password: string } | null; busy: boolean;
  onReveal: (id: string) => void; onDelete: (id: string) => void; onSettings: () => void; requiresUnlock: boolean
}) {
  const [query, setQuery] = useState("")
  const filtered = items.filter((item) => `${item.origin} ${item.username}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="space-y-3">
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="搜索保存的账号" placeholder="搜索网站或账号" className="h-8 pl-9 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>全部网站 · {items.length} 个账号</span><Button variant="ghost" className={`h-7 px-2 text-xs ${greenHover}`} onClick={onSettings}>导入 / 导出</Button></div>
    {requiresUnlock ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">旧版保险库需要先解锁一次，以生成加密的网站账号列表。</p> : !items.length ? <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
      <KeyRound className="size-8 text-muted-foreground" /><p className="text-sm font-medium">尚未保存账号和密码</p><p className="max-w-xs text-xs leading-5 text-muted-foreground">在网页登录时确认保存后，所有网站的账号都会显示在这里。</p>
    </div> : !filtered.length ? <p className="py-8 text-center text-sm text-muted-foreground">没有匹配的网站或账号</p> : <div className="space-y-2">
      {filtered.map((item) => {
        const shown = revealed?.id === item.id
        return <div key={item.id} className="rounded-lg border bg-background p-2.5">
          <div className="flex items-center gap-3"><SiteLogo origin={item.origin} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={item.origin}>{new URL(item.origin).host}</p><p className="truncate text-xs text-muted-foreground" title={item.username}>{item.username || "未提供账号"}</p></div></div>
          <div className="mt-2 flex items-center gap-1 rounded-md bg-muted/40 px-2.5 py-1"><span aria-label="已保存密码" className="min-w-0 flex-1 break-all font-mono text-xs select-text">{shown ? revealed.password : "••••••••"}</span><Button type="button" variant="ghost" size="icon" className={`size-6 shrink-0 ${greenHover}`} disabled={busy} aria-label={shown ? "隐藏密码" : "查看密码"} data-title={shown ? "隐藏密码" : "查看密码"} onClick={() => onReveal(item.id)}>{shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Button><Button type="button" variant="ghost" size="icon" className="size-6 shrink-0 text-red-600 hover:!bg-red-600 hover:!text-white [&:hover_svg]:!text-white" disabled={busy} aria-label="删除账号" data-title="删除账号" onClick={() => onDelete(item.id)}><Trash2 className="size-3.5" /></Button></div>
        </div>
      })}
    </div>}
  </div>
}
