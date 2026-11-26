import { useId, useState } from "react"
import { ChevronRight, Copy, Eye, GitBranch, Globe, KeyRound, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

type Entry = { id: string; origin: string; username: string; updated: number; kind?: "git"; gitPath?: string }
export function SiteLogo({ origin, compact = false }: { origin: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false)
  return <span className={`grid ${compact ? "size-6 rounded-md" : "size-8 rounded-lg"} shrink-0 place-items-center border bg-muted/40`}>
    {failed ? <Globe className="size-4 text-muted-foreground" /> : <img alt="" src={`${origin}/favicon.ico`} loading="lazy" referrerPolicy="no-referrer" className="size-4 object-contain" onError={() => setFailed(true)} />}
  </span>
}
const greenHover = "hover:!bg-green-600 hover:!text-white [&:hover_svg]:!text-white"
export function PasswordAccounts({ items, revealed, busy, onReveal, onDelete, onSettings, requiresUnlock }: {
  items: Entry[]; revealed: { id: string; password: string } | null; busy: boolean;
  onReveal: (id: string) => void; onDelete: (id: string) => void; onSettings: () => void; requiresUnlock: boolean
}) {
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Map<string, boolean>>(() => new Map())
  const groupId = useId()
  const searching = Boolean(query.trim())
  const filtered = items.filter((item) => `${item.origin} ${item.username} ${item.kind ?? ""} ${item.gitPath ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
  const groups = new Map<string, Entry[]>()
  for (const item of filtered) {
    const domain = new URL(item.origin).hostname
    const group = groups.get(domain)
    if (group) group.push(item)
    else groups.set(domain, [item])
  }
  return <div className="space-y-2">
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="搜索保存的账号" placeholder="搜索网站、Git 或账号" className="h-8 pl-9 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{items.some(item => item.kind === "git") ? "全部账号" : "全部网站"} · {items.length} 个账号</span><Button variant="ghost" className={`h-7 px-2 text-xs ${greenHover}`} onClick={onSettings}>导入 / 导出</Button></div>
    {requiresUnlock ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">旧版保险库需要先解锁一次，以生成加密的网站账号列表。</p> : !items.length ? <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
      <KeyRound className="size-8 text-muted-foreground" /><p className="text-sm font-medium">尚未保存账号和密码</p><p className="max-w-xs text-xs leading-5 text-muted-foreground">网页登录保存或 Git 认证成功后，账号会显示在这里。</p>
    </div> : !filtered.length ? <p className="py-8 text-center text-sm text-muted-foreground">没有匹配的网站或账号</p> : <div className="space-y-2">
      {Array.from(groups, ([domain, accounts]) => {
        const website = accounts.find(item => item.kind !== "git")
        const multipleOrigins = new Set(accounts.map(item => item.origin)).size > 1
        const expansionKey = `${query.trim().toLowerCase()}:${domain}`
        const open = expanded.get(expansionKey) ?? searching
        const contentId = `${groupId}-${encodeURIComponent(domain)}`
        return <section key={domain} aria-label={`${domain} 账号分组`} className="overflow-hidden rounded-lg border bg-background">
          <button type="button" aria-label={`${open ? "收起" : "展开"} ${domain} 账号分组`} aria-expanded={open} aria-controls={contentId}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/60"
            onClick={() => setExpanded(previous => { const next = new Map(previous); next.set(expansionKey, !open); return next })}>
            <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
            {website ? <SiteLogo origin={website.origin} compact /> : <span className="grid size-6 shrink-0 place-items-center rounded-md border bg-muted/40"><GitBranch className="size-3.5 text-muted-foreground" /></span>}
            <span className="min-w-0 flex-1 truncate text-xs font-medium" title={domain}>{domain}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{accounts.length} 个账号</span>
          </button>
          {open && <div id={contentId} className="divide-y border-t px-2.5">
            {accounts.map(item => {
              const shown = revealed?.id === item.id
              return <div key={item.id} className="flex min-w-0 items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={item.username}>{item.username || "未提供账号"}</p>
                  {item.kind === "git" && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Git</span>}
                </div>
                {multipleOrigins && <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={item.origin}>{item.origin}</p>}
                {item.kind === "git" && item.gitPath && <p className="mt-1 truncate text-[10px] text-muted-foreground" title={item.gitPath}>{item.gitPath}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1"><span aria-label="已保存密码" className="max-w-24 break-all font-mono text-[11px] select-text">{shown ? revealed.password : "••••••••"}</span><Button type="button" variant="ghost" size="icon" className={`size-6 shrink-0 ${greenHover}`} disabled={busy} aria-label={shown ? "复制密码" : "查看密码"} data-title={shown ? "复制密码" : "查看密码"} onClick={() => { if (shown) void navigator.clipboard.writeText(revealed.password).catch(() => toast.error("复制失败")); else onReveal(item.id) }}>{shown ? <Copy className="size-3.5" /> : <Eye className="size-3.5" />}</Button><Button type="button" variant="ghost" size="icon" className="size-6 shrink-0 text-red-600 hover:!bg-red-600 hover:!text-white [&:hover_svg]:!text-white" disabled={busy} aria-label="删除账号" data-title="删除账号" onClick={() => onDelete(item.id)}><Trash2 className="size-3.5" /></Button></div>
              </div>
            })}
          </div>}
        </section>
      })}
    </div>}
  </div>
}
