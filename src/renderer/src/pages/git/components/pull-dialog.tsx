import "./create-tag-dialog.css"
import { useEffect, useState } from "react"
import { Download, RefreshCw } from "lucide-react"
import type { GitPullOptions, GitPullSelection, GitPushInfo } from "@vessel/type/git"
import { GitPageDialog, GitPageDialogContent } from "./git-page-dialog"
import { GitOperationLoading } from "./operation-loading"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import { toast } from "@/components/ui/sonner"

export function PullDialog({ repoPath, initialRemote, initialBranch, onClose, onPull }: { repoPath: string; initialRemote?: string; initialBranch?: string; onClose: () => void; onPull: (selection: GitPullSelection) => Promise<void> }) {
  const [info, setInfo] = useState<GitPushInfo>()
  const [remote, setRemote] = useState("")
  const [branch, setBranch] = useState("")
  const [options, setOptions] = useState<GitPullOptions>({ commit: true, log: false, noFastForward: false, rebase: false })
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const current = info?.branches.find((item) => item.current)
  const branchesFor = (value: GitPushInfo, target: string) => value.remoteBranches.filter((name) => name.startsWith(target + "/")).map((name) => name.slice(target.length + 1))
  useEffect(() => {
    let alive = true
    void window.electronAPI.git.getPushInfo(repoPath).then((value) => {
      if (!alive) return
      const local = value.branches.find((item) => item.current)
      const preferred = initialRemote || local?.upstreamRemote || "origin"
      const target = value.remotes.find((item) => item.name === preferred)?.name || value.remotes[0]?.name || ""
      const names = branchesFor(value, target)
      setInfo(value); setRemote(target)
      const preferredBranch = initialBranch || (local?.upstreamRemote === target ? local.upstreamBranch : "") || local?.name || ""
      setBranch(names.includes(preferredBranch) ? preferredBranch : names[0] || preferredBranch)
    }).catch((reason) => { if (alive) setError(cleanGitErrorMessage(reason)) })
    return () => { alive = false }
  }, [repoPath, initialRemote, initialBranch])
  const refresh = async () => {
    if (!remote || refreshing) return
    setRefreshing(true); setError("")
    try {
      await window.electronAPI.git.fetch(repoPath, remote)
      const value = await window.electronAPI.git.getPushInfo(repoPath)
      const names = branchesFor(value, remote)
      setInfo(value)
      if (!names.includes(branch)) setBranch(names[0] || "")
    } catch (reason) { setError(cleanGitErrorMessage(reason)) }
    finally { setRefreshing(false) }
  }
  const submit = async () => {
    if (busy || refreshing || !remote || !branch || !current) return
    setBusy(true); setError("")
    try { await onPull({ remote, branch, options }); onClose() }
    catch (reason) { toast.error(cleanGitErrorMessage(reason)) }
    finally { setBusy(false) }
  }
  const names = [...new Set([branch, ...(info ? branchesFor(info, remote) : [])].filter(Boolean))]
  return <GitPageDialog open onOpenChange={(open) => { if (!open && !busy && !refreshing) onClose() }}>
    <GitPageDialogContent showCloseButton={!busy && !refreshing} className={`git-dialog git-tag-dialog gap-0 overflow-hidden p-0 ${busy ? "max-w-[320px] border-0" : "max-w-[520px]"}`} onInteractOutside={(event) => { if (busy || refreshing) event.preventDefault() }}>
      <DialogHeader className={busy ? "sr-only" : "border-b bg-stone-50/60 px-4 py-3 dark:bg-white/[.02]"}><DialogTitle className="flex items-center gap-2 text-sm"><Download className="size-4 text-green-600" />拉取分支</DialogTitle><DialogDescription className="text-xs">选择远程分支，将更新整合到当前本地分支。</DialogDescription></DialogHeader>
      {busy ? <GitOperationLoading inline operation="pull" branch={current?.name || branch} /> : <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <fieldset disabled={refreshing} className="space-y-3 px-4 py-3 text-xs">
          <div className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
            <span>从仓库拉取</span><Select value={remote} disabled={!info?.remotes.length} onValueChange={(value) => { if (!value || !info) return; setRemote(value); const names = branchesFor(info, value); setBranch(names.includes(current?.name || "") ? current!.name : names[0] || "") }}><SelectTrigger aria-label="从仓库拉取" className="git-tag-field h-8 w-full text-xs"><SelectValue placeholder="选择仓库" /></SelectTrigger><SelectContent>{info?.remotes.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select>
            <span className="sr-only">远程仓库地址</span><Input aria-label="远程仓库地址" disabled className="col-start-2 h-8 text-xs disabled:opacity-100" value={info?.remotes.find((item) => item.name === remote)?.url || ""} />
            <span>远程分支</span><div className="flex min-w-0 gap-2"><Select value={branch} disabled={!names.length} onValueChange={(value) => { if (value) setBranch(value) }}><SelectTrigger aria-label="要拉取的远程分支" className="git-tag-field h-8 min-w-0 flex-1 text-xs"><SelectValue placeholder="选择远程分支" /></SelectTrigger><SelectContent>{names.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" size="sm" className="git-tag-ghost h-8 text-xs" disabled={!remote || refreshing} onClick={() => void refresh()}><RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />刷新</Button></div>
            <span>拉取到本地分支</span><strong className="truncate font-medium">{current?.name || "未检出本地分支"}</strong>
          </div>
          <fieldset className="space-y-2 rounded-md border p-3"><legend className="px-1 text-muted-foreground">选项</legend>
            {([['commit', '立即提交合并的改动'], ['log', '包括被合并提交的信息内容'], ['noFastForward', '即使可以快进，也创建合并提交'], ['rebase', '使用变基代替合并']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2"><Checkbox className="git-tag-check" checked={options[key]} disabled={key !== 'rebase' && options.rebase} onCheckedChange={(checked) => setOptions((value) => ({ ...value, [key]: checked === true }))} />{label}</label>)}
            {options.rebase && <p className="text-[11px] text-muted-foreground">变基会重放本地提交，合并选项不生效。</p>}
          </fieldset>
          {!info && !error && <p role="status">正在读取分支…</p>}
          {info && !current && <p role="alert" className="text-amber-600">请先检出本地分支。</p>}
        </fieldset>
        {error && <p role="alert" className="whitespace-pre-wrap break-words px-4 pb-3 text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t bg-stone-50/60 px-4 py-2 dark:bg-white/[.02]"><Button type="button" variant="outline" size="sm" className="git-tag-cancel h-8 text-xs" disabled={refreshing} onClick={onClose}>取消</Button><Button type="submit" size="sm" className="git-tag-submit h-8 text-xs" disabled={!remote || !branch || !current || refreshing}>确定</Button></div>
      </form>}
    </GitPageDialogContent>
  </GitPageDialog>
}
