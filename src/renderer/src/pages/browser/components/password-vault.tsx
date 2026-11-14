import { SitePasswordPopover } from "./site-password-popover"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { PasswordAccounts } from "./password-accounts"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye, EyeOff } from "lucide-react"

type Entry = { id: string; origin: string; username: string; updated: number }
type Candidate = { id: string; origin: string; username: string }
export function PasswordVault({ guestId, url }: { guestId?: () => number | undefined; url?: string }) {
  const [open, setOpen] = useState(false), [state, setState] = useState({ initialized: false, unlocked: false })
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState(""), [exportPassword, setExportPassword] = useState("")
  const [items, setItems] = useState<Entry[]>([]), [candidate, setCandidate] = useState<Candidate | null>(null)
  const [manage, setManage] = useState(false), [unlockRequested, setUnlockRequested] = useState(false), [requiresUnlock, setRequiresUnlock] = useState(false)
  const [siteOpen, setSiteOpen] = useState(false), [siteSelectedId, setSiteSelectedId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<{ id: string; password: string } | null>(null)
  const revealRevision = useRef(0)
  useEffect(() => {
    const show = () => { revealRevision.current++; setRevealed(null); setSiteOpen(false); setSiteSelectedId(null); setManage(true); setUnlockRequested(false); setPreviewId(null); setOpen(true) }
    window.addEventListener("vessel-open-password-vault", show)
    return () => window.removeEventListener("vessel-open-password-vault", show)
  }, [])
  useEffect(() => {
    return () => { revealRevision.current++ }
  }, [])
  useEffect(() => {
    // Native authentication temporarily blurs Vessel; only clear an already displayed secret.
    const hide = () => setRevealed(null)
    window.addEventListener("blur", hide)
    const timer = revealed ? setTimeout(hide, 15000) : undefined
    return () => { clearTimeout(timer); window.removeEventListener("blur", hide) }
  }, [revealed])
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  useEffect(() => {
    if (state.unlocked) return
    const timer = setTimeout(() => { setPassword(""); setConfirmation(""); setExportPassword(""); setCandidate(null) }, 0)
    return () => clearTimeout(timer)
  }, [state.unlocked])
  const lastURL = useRef(url)
  useEffect(() => {
    if (lastURL.current === url) return undefined
    lastURL.current = url
    revealRevision.current++
    const timer = setTimeout(() => { setSiteOpen(false); setSiteSelectedId(null); setRevealed(null); setUnlockRequested(false); setPreviewId(null) }, 0)
    return () => clearTimeout(timer)
  }, [url])
  const api = window.electronAPI
  const refresh = async () => {
    const next = await api.vaultRequest("status")
    if (!next.unlocked) { revealRevision.current++; setRevealed(null) }
    setState(next)
    const catalog = await api.vaultRequest("catalog")
    setItems(catalog.items); setRequiresUnlock(catalog.requiresUnlock)
  }
  useEffect(() => api.onVaultCandidate((next) => { revealRevision.current++; setRevealed(null); setCandidate(next); setSiteOpen(false); setManage(false); setOpen(true) }), [])
  useEffect(() => {
    const initial = setTimeout(() => void refresh().catch((reason) => setError(String(reason))), 0)
    const timer = setInterval(() => void refresh().catch(() => {}), open || siteOpen ? 3000 : 10000)
    return () => { clearTimeout(initial); clearInterval(timer) }
  }, [open, siteOpen, url])
  const run = async (action: string, data?: Record<string, string>) => {
    if (busy) return
    setBusy(true); setError("")
    try {
      await api.vaultRequest(action, data)
      setPassword(""); setConfirmation(""); setExportPassword("")
      await refresh()
      if (action === "unlock") setUnlockRequested(false)
      if (action === "candidate") setCandidate(null)
      if (action === "fill") { revealRevision.current++; setRevealed(null); setOpen(false) }
      return true
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); return false }
    finally { setBusy(false) }
  }
  const changeOpen = (next: boolean) => {
    if (busy) return
    revealRevision.current++; setRevealed(null)
    setOpen(next); setError(""); setPassword(""); setConfirmation(""); setExportPassword("")
    if (!next && candidate) { void api.vaultRequest("candidate", { id: candidate.id, choice: "dismiss" }).catch(() => {}); setCandidate(null) }
  }
  const reveal = async (id: string, unlocked = state.unlocked) => {
    if (busy) return false
    if (!unlocked) { setPreviewId(id); setUnlockRequested(true); return false }
    if (revealed?.id === id) { setRevealed(null); return false }
    const revision = ++revealRevision.current
    setBusy(true); setError("")
    try {
      const result = await api.vaultRequest("reveal", { id })
      if (revision !== revealRevision.current) return false
      setRevealed({ id, password: result.password })
      return true
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); return false }
    finally { setBusy(false) }
  }
  let origin = ""
  try { origin = new URL(url || "").origin } catch { /* No active page. */ }
  const siteAccounts = items.filter((item) => item.origin === origin)
  const selectedSiteAccount = siteAccounts.find((item) => item.id === siteSelectedId)
  const changeSiteOpen = (next: boolean) => {
    if (busy) return
    revealRevision.current++; setRevealed(null); setSiteSelectedId(null); setUnlockRequested(false); setPreviewId(null); setError("")
    setSiteOpen(next)
  }
  const openManager = () => {
    changeSiteOpen(false); setManage(true); changeOpen(true)
  }
  const unlockForm = state.initialized && !state.unlocked && (unlockRequested || requiresUnlock) ? <form className="space-y-3 rounded-xl border p-3" onSubmit={(event) => {
    event.preventDefault(); event.stopPropagation()
    const selected = previewId
    void run("unlock", { password }).then(async (success) => {
      if (success && selected) {
        setPreviewId(null)
        if (await reveal(selected, true) && siteOpen) setSiteSelectedId(selected)
      }
    })
  }}>
    <p className="text-xs text-muted-foreground">此保险库受主密码保护，请先解锁；查看密码还需通过系统身份验证。</p>
    <Input type="password" aria-label="主密码" autoComplete="current-password" placeholder="输入保险库主密码" value={password} onChange={(event) => setPassword(event.target.value)} />
    <Button type="submit" disabled={busy || password.length < 12}>解锁保险库</Button>
  </form> : null
  const Panel = manage ? Sheet : Dialog
  const PanelContent = manage ? SheetContent : DialogContent
  return <>
    <SitePasswordPopover accounts={siteAccounts} open={siteOpen} onOpenChange={changeSiteOpen} selected={selectedSiteAccount}
      password={selectedSiteAccount && revealed?.id === siteSelectedId ? revealed.password : undefined} busy={busy} error={error} unlockForm={siteOpen ? unlockForm : null}
      onSelect={(id) => { void reveal(id).then((success) => { if (success) setSiteSelectedId(id) }) }}
      onBack={() => { revealRevision.current++; setRevealed(null); setSiteSelectedId(null) }}
      onTogglePassword={() => { if (siteSelectedId) void reveal(siteSelectedId) }} onManage={openManager} />
    <ConfirmDialog activityBarAccessible statusBarAccessible open={!!deleteId} onOpenChange={(next) => { if (!next) setDeleteId(null) }} title="删除已保存账号" description="删除后无法恢复，是否继续？" confirmText="删除" busy={busy} onConfirm={() => { if (deleteId) void run("delete", { id: deleteId }).then(() => setDeleteId(null)) }} />
    <Panel modal={false} open={open} onOpenChange={changeOpen}>
      <DialogPortal>
        <div data-vault-overlay aria-hidden="true" className="fixed top-0 right-0 bottom-8 left-[52px] z-[220] bg-black/[.04] backdrop-blur-[3px]" />
      </DialogPortal>
      <PanelContent {...(manage ? { showOverlay: false, side: "right" as const } : {})} onSubmit={(event) => event.stopPropagation()} className={manage ? "z-[221] top-0 bottom-8 flex h-auto w-[calc(100%-52px)] flex-col sm:max-w-xl" : "z-[221] left-[calc(50%+26px)] flex max-h-[85vh] w-[calc(100%-84px)] flex-col"}>
        <DialogHeader><DialogTitle>{manage ? "账号和密码" : "密码保险库"}</DialogTitle><DialogDescription>{manage ? "查看 Vessel 保存的所有网站账号，密码默认隐藏。查看密码需要验证身份。" : "本地加密保存。检测到 HTTPS 登录账号密码后询问保存，闲置 5 分钟或锁屏后自动锁定。主密码遗忘无法恢复。"}</DialogDescription></DialogHeader>
        <ScrollArea className={manage ? "min-h-0 flex-1" : "min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]]:max-h-[55vh]"}>
          <div className="space-y-3 pr-3 text-sm">
            {manage ? <>
              <PasswordAccounts items={items} revealed={revealed} busy={busy} requiresUnlock={requiresUnlock} onReveal={(id) => void reveal(id)} onSettings={() => setManage(false)} />
              {unlockForm}
            </> : <>
            {candidate && !state.unlocked && <div className="rounded border p-3 text-sm">
              <p>检测到登录账号，是否保存到 Vessel？</p>
              <p className="mt-1 break-all text-muted-foreground">{candidate.origin} · {candidate.username}</p>
              <p className="mt-2 text-xs text-muted-foreground">请先{state.initialized ? "解锁" : "创建"}保险库，再确认保存。候选内容仅临时保留 60 秒。</p>
              <Button variant="outline" className="mt-2" disabled={busy} onClick={() => void run("candidate", { id: candidate.id, choice: "dismiss" })}>此次不保存</Button>
            </div>}
            {!state.unlocked ? <form className="space-y-3" onSubmit={(event) => {
              event.preventDefault()
              if (!state.initialized && password !== confirmation) { setError("两次主密码不一致"); return }
              void run(state.initialized ? "unlock" : "create", { password })
            }}>
              <Input type="password" aria-label="主密码" autoComplete={state.initialized ? "current-password" : "new-password"} placeholder="主密码（至少 12 个字符）" value={password} onChange={(event) => setPassword(event.target.value)} />
              {!state.initialized && <Input type="password" aria-label="确认主密码" autoComplete="new-password" placeholder="再次输入主密码" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />}
              <Button disabled={busy || password.length < 12} type="submit">{state.initialized ? "解锁" : "创建保险库"}</Button>
            </form> : <>
              <Button variant="outline" disabled={busy} onClick={() => void run("lock")}>锁定保险库</Button>
              {candidate && <div className="space-y-2 rounded border p-3">
                <p>保存或更新此账号？</p><p className="break-all">{candidate.origin} · {candidate.username || "未提供账号"}</p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void run("candidate", { id: candidate.id, choice: "save" })}>保存 / 更新</Button>
                  <Button variant="outline" disabled={busy} onClick={() => void run("candidate", { id: candidate.id, choice: "dismiss" })}>此次不保存</Button>
                  <Button variant="outline" disabled={busy} onClick={() => void run("candidate", { id: candidate.id, choice: "never" })}>此网站永不保存</Button>
                </div>
              </div>}
              <p className="text-muted-foreground">已保存 {items.length} 个账号；只能填充到相同 HTTPS 来源，包含端口。</p>
              {items.map((item) => <div key={item.id} className="space-y-2 rounded border p-3">
                <p className="break-all">{item.origin}</p><p className="break-all">{item.username || "未提供账号"}</p>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 break-all font-mono text-xs select-text" aria-label="已保存密码">{revealed?.id === item.id ? revealed.password : "••••••••"}</span>
                  <Button variant="outline" disabled={busy} aria-label={revealed?.id === item.id ? "隐藏密码" : "查看密码"} onClick={() => void reveal(item.id)}>
                    {revealed?.id === item.id ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {revealed?.id === item.id ? "隐藏密码" : "查看密码"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  {guestId && <Button disabled={busy || origin !== item.origin} onClick={() => {
                    const id = guestId()
                    if (id !== undefined) void run("fill", { id: item.id, guestId: String(id) })
                  }}>填充当前网页</Button>}
                  <Button variant="outline" disabled={busy} onClick={() => setDeleteId(item.id)}>删除</Button>
                </div>
              </div>)}
              <details className="rounded border p-3"><summary className="cursor-pointer">加密导出备份</summary>
                <p className="my-2 text-xs text-muted-foreground">重新输入主密码。导出时设置独立口令，导入时输入备份口令；重复账号会保留当前记录。</p>
                <Input className="mb-2" type="password" aria-label="导出验证主密码" autoComplete="off" placeholder="当前主密码" value={password} onChange={(event) => setPassword(event.target.value)} />
                <Input className="mb-2" type="password" aria-label="导出口令" autoComplete="new-password" placeholder="独立导出口令（至少 12 个字符）" value={exportPassword} onChange={(event) => setExportPassword(event.target.value)} />
                <Button disabled={busy || password.length < 12 || exportPassword.length < 12 || exportPassword === password} onClick={() => void run("export", { password, exportPassword })}>导出加密备份</Button>
                <Button className="ml-2" variant="outline" disabled={busy || password.length < 12 || exportPassword.length < 12} onClick={() => void run("import", { password, exportPassword })}>导入加密备份</Button>
              </details>
            </>}
            </>}
            {error && <p role="alert" className="break-all text-sm text-red-600">{error}</p>}
            {busy && <p role="status">正在处理…</p>}
          </div>
        </ScrollArea>
      </PanelContent>
    </Panel>
  </>
}
