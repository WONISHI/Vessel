import { useState } from "react"
import { Eye, EyeOff, Globe, KeyRound, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Entry = { id: string; origin: string; username: string; updated: number }
export function SiteLogo({ origin }: { origin: string }) {
  const [failed, setFailed] = useState(false)
  return <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-muted/40">
    {failed ? <Globe className="size-5 text-muted-foreground" /> : <img alt="" src={`${origin}/favicon.ico`} loading="lazy" referrerPolicy="no-referrer" className="size-5 object-contain" onError={() => setFailed(true)} />}
  </span>
}
export function PasswordAccounts({ items, revealed, busy, onReveal, onSettings, requiresUnlock }: {
  items: Entry[]; revealed: { id: string; password: string } | null; busy: boolean;
  onReveal: (id: string) => void; onSettings: () => void; requiresUnlock: boolean
}) {
  const [query, setQuery] = useState("")
  const filtered = items.filter((item) => `${item.origin} ${item.username}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="space-y-4">
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="搜索保存的账号" placeholder="搜索网站或账号" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>全部网站 · {items.length} 个账号</span><Button variant="ghost" className="h-7 px-2 text-xs" onClick={onSettings}>保险库设置</Button></div>
    {requiresUnlock ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">旧版保险库需要先解锁一次，以生成加密的网站账号列表。</p> : !items.length ? <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
      <KeyRound className="size-8 text-muted-foreground" /><p className="text-sm font-medium">尚未保存账号和密码</p><p className="max-w-xs text-xs leading-5 text-muted-foreground">在网页登录时确认保存后，所有网站的账号都会显示在这里。</p>
    </div> : !filtered.length ? <p className="py-8 text-center text-sm text-muted-foreground">没有匹配的网站或账号</p> : <div className="space-y-2">
      {filtered.map((item) => {
        const shown = revealed?.id === item.id
        return <div key={item.id} className="rounded-xl border bg-background p-3">
          <div className="flex items-center gap-3"><SiteLogo origin={item.origin} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={item.origin}>{new URL(item.origin).host}</p><p className="truncate text-xs text-muted-foreground" title={item.username}>{item.username || "未提供账号"}</p></div></div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5"><span aria-label="已保存密码" className="min-w-0 flex-1 break-all font-mono text-xs select-text">{shown ? revealed.password : "••••••••"}</span><Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" disabled={busy} aria-label={shown ? "隐藏密码" : "查看密码"} data-title={shown ? "隐藏密码" : "查看密码"} onClick={() => onReveal(item.id)}>{shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div>
        </div>
      })}
    </div>}
  </div>
}
