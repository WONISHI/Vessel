import type { ReactNode } from "react"
import { ArrowLeft, ChevronRight, Copy, ExternalLink, Eye, EyeOff, KeyRound, Settings, UserRound, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SiteLogo } from "./password-accounts"

type Account = { id: string; origin: string; username: string }
export function SitePasswordPopover({ accounts, open, onOpenChange, selected, password, busy, error, unlockForm, onSelect, onBack, onTogglePassword, onManage }: {
  accounts: Account[]; open: boolean; onOpenChange: (open: boolean) => void; selected: Account | undefined;
  password: string | undefined; busy: boolean; error: string; unlockForm: ReactNode;
  onSelect: (id: string) => void; onBack: () => void; onTogglePassword: () => void; onManage: () => void
}) {
  if (!accounts.length) return null
  const copy = (text: string) => { void navigator.clipboard.writeText(text).catch(() => toast.error("复制失败")) }
  return <Popover open={open} onOpenChange={onOpenChange} modal={false}>
    <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 hover:text-white [&:hover_svg]:text-white" aria-label="此网站已保存的密码" data-title="此网站已保存的密码"><KeyRound className="size-4" /></Button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={10} className="z-[260] w-80 max-w-[calc(100vw-68px)] overflow-hidden rounded-xl p-0 data-[state=closed]:animate-none" onCloseAutoFocus={(event) => event.preventDefault()} onFocusOutside={(event) => event.preventDefault()} onInteractOutside={(event) => { if (busy) event.preventDefault() }} onSubmit={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-2 px-4 py-3">
        {selected ? <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label="返回账号列表" onClick={onBack}><ArrowLeft className="size-4" /></Button> : <KeyRound className="size-4 shrink-0 text-green-600" />}
        <h3 className="min-w-0 flex-1 truncate text-xs font-medium">{selected ? new URL(selected.origin).host : "已保存用于登录此网站的密码"}</h3>
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label="关闭网站密码" disabled={busy} onClick={() => onOpenChange(false)}><X className="size-4" /></Button>
      </div>
      {selected ? <div className="space-y-3 px-4 pb-4">
        <div className="flex items-center gap-3"><UserRound className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 break-all text-sm select-text">{selected.username || "未提供账号"}</span><Button type="button" variant="ghost" size="icon" className="size-7" aria-label="复制账号" onClick={() => copy(selected.username)}><Copy className="size-4" /></Button></div>
        <div className="flex items-center gap-3"><KeyRound className="size-4 shrink-0 text-muted-foreground" /><span aria-label="本站账号密码" className="min-w-0 flex-1 break-all font-mono text-xs select-text">{password ?? "••••••••"}</span><Button type="button" variant="ghost" size="icon" className="size-7" disabled={busy} aria-label={password === undefined ? "查看密码" : "隐藏密码"} onClick={onTogglePassword}>{password === undefined ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</Button><Button type="button" variant="ghost" size="icon" className="size-7" disabled={password === undefined} aria-label="复制密码" onClick={() => { if (password !== undefined) copy(password) }}><Copy className="size-4" /></Button></div>
      </div> : <div className="max-h-60 overflow-y-auto px-2 pb-2">{accounts.map((account) => <button type="button" key={account.id} disabled={busy} aria-label={`查看账号 ${account.username || "未提供账号"}`} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted disabled:opacity-50" onClick={() => onSelect(account.id)}><SiteLogo origin={account.origin} /><span className="min-w-0 flex-1 truncate text-sm">{account.username || "未提供账号"}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></button>)}</div>}
      {unlockForm && <div className="px-4 pb-3">{unlockForm}</div>}
      {error && <p role="alert" className="px-4 pb-3 text-xs text-red-600">{error}</p>}
      {busy && <p role="status" className="px-4 pb-3 text-xs text-muted-foreground">正在验证身份…</p>}
      <button type="button" onClick={onManage} disabled={busy} className="flex w-full items-center gap-3 border-t px-4 py-3 text-sm hover:bg-muted disabled:opacity-50"><Settings className="size-4" /><span className="flex-1 text-left">管理密码</span><ExternalLink className="size-4 text-muted-foreground" /></button>
    </PopoverContent>
  </Popover>
}
