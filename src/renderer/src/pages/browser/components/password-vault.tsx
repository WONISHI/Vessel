import { BrowserSheetContent as SheetContent } from "@/pages/browser/components/browser-sheet"
import { useDialogLayout } from "@/features/layout/use-dialog-layout"
import { SitePasswordPopover } from "./site-password-popover"
import { Sheet } from "@/components/ui/sheet"
import { PasswordAccounts } from "./password-accounts"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye, EyeOff, KeyRound } from "lucide-react"
import "./password-vault.css"

type Entry = { id: string; origin: string; username: string; updated: number; kind?: "git"; gitPath?: string }
type Candidate = { id: string; origin: string; username: string }
export function PasswordVault({ guestId, url }: { guestId?: () => number | undefined; url?: string }) {
  const layout = useDialogLayout(true)
  const [open, setOpen] = useState(false), [state, setState] = useState<{ initialized: boolean; unlocked: boolean; auto?: boolean; source?: "remote" }>({ initialized: false, unlocked: true, auto: true })
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState(""), [exportPassword, setExportPassword] = useState("")
  const [items, setItems] = useState<Entry[]>([]), [candidate, setCandidate] = useState<Candidate | null>(null)
  const [manage, setManage] = useState(false), [unlockRequested, setUnlockRequested] = useState(false), [requiresUnlock, setRequiresUnlock] = useState(false)
  const [siteOpen, setSiteOpen] = useState(false), [siteSelectedId, setSiteSelectedId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [importLocalOpen, setImportLocalOpen] = useState(false)
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
    const timer = revealed ? setTimeout(hide, 10000) : undefined
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
    } catch (reason) {
      // Cancelling or failing the system authentication simply leaves the password hidden.
      const message = (reason instanceof Error ? reason.message : String(reason)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")
      if (!message.includes("系统身份验证")) setError(message)
      return false
    }
    finally { setBusy(false) }
  }
  let origin = ""
  try { origin = new URL(url || "").origin } catch { /* No active page. */ }
  const siteAccounts = items.filter((item) => item.kind !== "git" && item.origin === origin)
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
    <ConfirmDialog activityBarAccessible statusBarAccessible tone="primary" busy={busy} error={error} open={importLocalOpen} onOpenChange={setImportLocalOpen} title="导入本机账号到当前远程保险库？" description="本机保存的网站和 Git 账号将重新加密后上传到当前登录账号。相同账号保留远程已有记录，本机记录继续保留。导入需要系统身份验证。" confirmText="验证并导入" onConfirm={async () => { if (await run("import-local")) setImportLocalOpen(false) }} />
    <SitePasswordPopover accounts={siteAccounts} open={siteOpen} onOpenChange={changeSiteOpen} selected={selectedSiteAccount}
      password={selectedSiteAccount && revealed?.id === siteSelectedId ? revealed.password : undefined} busy={busy} error={error} unlockForm={siteOpen ? unlockForm : null}
      onSelect={(id) => { void reveal(id).then((success) => { if (success) setSiteSelectedId(id) }) }}
      onBack={() => { revealRevision.current++; setRevealed(null); setSiteSelectedId(null) }}
      onTogglePassword={() => { if (siteSelectedId) void reveal(siteSelectedId) }} onManage={openManager} />
    <ConfirmDialog activityBarAccessible statusBarAccessible open={!!deleteId} onOpenChange={(next) => { if (!next) setDeleteId(null) }} title="删除已保存账号" description="删除后无法恢复，是否继续？" confirmText="删除" busy={busy} onConfirm={() => { if (deleteId) void run("delete", { id: deleteId }).then(() => setDeleteId(null)) }} />
    <Panel modal={false} open={open} onOpenChange={changeOpen}>
      {!manage && <DialogPortal>
        <div data-vault-overlay aria-hidden="true" style={layout.overlayStyle} className="fixed top-0 right-0 z-[220] bg-black/[.04] backdrop-blur-[3px]" />
      </DialogPortal>}
      <PanelContent onFocusOutside={(event) => { if (manage) event.preventDefault() }} data-vault-settings={manage ? undefined : ""} style={manage ? layout.sheetStyle : layout.contentStyle} {...(manage ? { showOverlay: false, side: "right" as const } : { showCloseButton: false })} onSubmit={(event) => event.stopPropagation()} className={manage ? "z-[221] top-0 flex h-auto flex-col gap-2 p-3 sm:max-w-sm" : "z-[221] flex max-h-[85vh] max-w-[460px] flex-col gap-0 overflow-hidden p-0"}>
        <div className={manage ? undefined : "flex shrink-0 items-center gap-3 border-b border-stone-200/80 px-5 py-3.5 dark:border-stone-700/70"}>
          {!manage && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"><KeyRound className="size-4" /></span>}
          <DialogHeader className={manage ? undefined : "min-w-0 space-y-0.5 text-left"}><DialogTitle className={"text-[15px] font-semibold"}>{manage ? "账号和密码" : candidate ? "保存密码？" : "账号和密码设置"}</DialogTitle><DialogDescription className="text-xs leading-5">{state.source === "remote" ? "账号和密码加密保存在当前远程保险库；重装后使用原账号和原登录密码恢复，查看密码仍需系统身份验证。" : manage ? "查看本机保存的网站和 Git 账号，密码默认隐藏。查看密码需要验证身份。" : candidate ? "Vessel 会加密保存到本机数据库，密钥由系统钥匙串保护。" : "账号和密码加密保存在本机数据库；查看密码需要通过系统身份验证。"}</DialogDescription></DialogHeader>
        </div>
        <ScrollArea className={manage ? "min-h-0 flex-1" : "min-h-0 flex-1 px-5 py-4 [&_[data-radix-scroll-area-viewport]]:max-h-[55vh]"}>
          <div className={manage ? "space-y-2 pr-1 text-xs" : "space-y-3 text-xs"}>
            {manage ? <>
              {state.source === "remote" && <div className="space-y-2 pb-2 text-xs"><p className="text-muted-foreground">本机账号不会自动上传；忘记原登录密码且没有恢复方式时，重置密码无法解开原保险库。</p><Button variant="outline" size="sm" disabled={busy} onClick={() => setImportLocalOpen(true)}>导入本机账号</Button></div>}
              <PasswordAccounts items={items} revealed={revealed} busy={busy} requiresUnlock={requiresUnlock} onReveal={(id) => void reveal(id)} onDelete={setDeleteId} onSettings={() => setManage(false)} />
              {unlockForm}
            </> : <>
            {candidate && !state.unlocked && <div className="rounded border p-3 text-sm">
              <p>检测到登录账号，是否保存到 Vessel？</p>
              <p className="mt-1 break-all text-muted-foreground">{candidate.origin} · {candidate.username}</p>
              <p className="mt-2 text-xs text-muted-foreground">请先{state.initialized ? "解锁" : "创建"}保险库，再确认保存。候选内容仅临时保留 60 秒。</p>
              <Button variant="outline" className="mt-2 hover:!bg-stone-100 dark:hover:!bg-white/10" disabled={busy} onClick={() => void run("candidate", { id: candidate.id, choice: "dismiss" })}>此次不保存</Button>
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
              {!state.auto && <Button variant="outline" disabled={busy} onClick={() => void run("lock")}>锁定保险库</Button>}
              {candidate && <div className="space-y-2 rounded border p-3">
                <p>保存此网站的账号和密码？</p><p className="break-all">{candidate.origin} · {candidate.username || "未提供账号"}</p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void run("candidate", { id: candidate.id, choice: "save" })}>保存 / 更新</Button>
                  <Button variant="outline" className="hover:!bg-stone-100 dark:hover:!bg-white/10" disabled={busy} onClick={() => void run("candidate", { id: candidate.id, choice: "dismiss" })}>此次不保存</Button>
                  <Button variant="outline" className="hover:!bg-stone-100 dark:hover:!bg-white/10" disabled={busy} onClick={() => void run("candidate", { id: candidate.id, choice: "never" })}>此网站永不保存</Button>
                </div>
              </div>}
              {!candidate && <p className="text-muted-foreground">已保存 {items.length} 个账号；只能填充到相同网站来源，协议、主机和端口均须一致。</p>}
              {!candidate && items.map((item) => <div key={item.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><p className="min-w-0 break-all font-medium">{item.origin}</p><p className="min-w-0 break-all text-muted-foreground">{item.username || "未提供账号"}</p></div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 break-all font-mono text-xs select-text" aria-label="已保存密码">{revealed?.id === item.id ? revealed.password : "••••••••"}</span>
                  <Button variant="outline" className="hover:text-white" disabled={busy} aria-label={revealed?.id === item.id ? "隐藏密码" : "查看密码"} onClick={() => void reveal(item.id)}>
                    {revealed?.id === item.id ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {revealed?.id === item.id ? "隐藏密码" : "查看密码"}
                  </Button>
                  {guestId && <Button disabled={busy || origin !== item.origin} onClick={() => {
                    const id = guestId()
                    if (id !== undefined) void run("fill", { id: item.id, guestId: String(id) })
                  }}>填充当前网页</Button>}
                  <Button variant="outline" className="hover:!bg-stone-100 dark:hover:!bg-white/10" disabled={busy} onClick={() => setDeleteId(item.id)}>删除</Button>
                </div>
              </div>)}
              {!candidate && <details className="rounded border p-3"><summary className="cursor-pointer">加密导出备份</summary>
                <p className="my-2 text-xs text-muted-foreground">导出时设置独立口令，导入时输入备份口令；重复账号会保留当前记录。</p>
                {!state.auto && <Input className="mb-2" type="password" aria-label="导出验证主密码" autoComplete="off" placeholder="当前主密码" value={password} onChange={(event) => setPassword(event.target.value)} />}
                <Input className="mb-2" type="password" aria-label="导出口令" autoComplete="new-password" placeholder="独立导出口令（至少 12 个字符）" value={exportPassword} onChange={(event) => setExportPassword(event.target.value)} />
                <Button disabled={busy || (!state.auto && (password.length < 12 || exportPassword === password)) || exportPassword.length < 12} onClick={() => void run("export", { password, exportPassword })}>导出加密备份</Button>
                <Button className="ml-2" variant="outline" disabled={busy || (!state.auto && password.length < 12) || exportPassword.length < 12} onClick={() => void run("import", { password, exportPassword })}>导入加密备份</Button>
              </details>}
            </>}
            </>}
            {error && <p role="alert" className="break-all text-sm text-red-600">{error}</p>}
          </div>
        </ScrollArea>
        {!manage && <div className="flex shrink-0 justify-end border-t border-stone-200/80 px-5 py-3 dark:border-stone-700/70"><Button variant="outline" size="sm" onClick={() => changeOpen(false)}>关闭</Button></div>}
      </PanelContent>
    </Panel>
  </>
}
