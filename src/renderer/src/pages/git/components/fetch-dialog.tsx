import "./create-tag-dialog.css"
import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import type { GitFetchSelection, GitPushInfo } from "@vessel/type/git"
import { GitPageDialog, GitPageDialogContent } from "./git-page-dialog"
import { GitOperationLoading } from "./operation-loading"
import { RemoteDialogFooter, RemoteDialogHeader } from "./remote-dialog-layout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cleanGitErrorMessage } from "@/pages/git/utils"

export function FetchDialog({ repoPath, initialRemote, onClose, onFetch }: { repoPath: string; initialRemote?: string; onClose: () => void; onFetch: (selection: GitFetchSelection) => Promise<void> }) {
  const [info, setInfo] = useState<GitPushInfo>()
  const [remote, setRemote] = useState(initialRemote || "")
  const [all, setAll] = useState(!initialRemote)
  const [prune, setPrune] = useState(false)
  const [tags, setTags] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let alive = true
    void window.electronAPI.git.getPushInfo(repoPath).then((value) => {
      if (!alive) return
      setInfo(value)
      const preferred = initialRemote || value.branches.find((branch) => branch.current)?.upstreamRemote || "origin"
      setRemote(value.remotes.find((item) => item.name === preferred)?.name || value.remotes[0]?.name || "")
    }).catch((reason) => { if (alive) setError(cleanGitErrorMessage(reason)) })
    return () => { alive = false }
  }, [repoPath, initialRemote])
  const submit = async () => {
    if (busy || !info?.remotes.length || (!all && !remote)) return
    setBusy(true); setError("")
    try { await onFetch({ remote, all, prune, tags }); onClose() }
    catch (reason) { setError(cleanGitErrorMessage(reason)) }
    finally { setBusy(false) }
  }
  return <GitPageDialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <GitPageDialogContent showCloseButton={!busy} className={`git-dialog git-tag-dialog flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 ${busy ? "max-w-[320px] border-0" : "max-w-[460px]"}`} onInteractOutside={(event) => { if (busy) event.preventDefault() }}>
      <RemoteDialogHeader hidden={busy} icon={<RefreshCw className="size-4" />} title="抓取远端更新" description="更新远程跟踪分支，不合并到当前本地分支。" />
      {busy ? <GitOperationLoading inline operation="fetch" branch={all ? "所有远程仓库" : remote} /> : <form className="flex min-h-0 min-w-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <fieldset className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-xs">
          <label className="flex items-center gap-2"><Checkbox className="git-tag-check" checked={all} onCheckedChange={(value) => setAll(value === true)} />抓取所有远端更新</label>
          {!all && <div className="flex items-center gap-3"><span className="shrink-0 text-muted-foreground">远程仓库</span><Select value={remote} disabled={!info?.remotes.length} onValueChange={(value) => { if (value) setRemote(value) }}><SelectTrigger aria-label="抓取远程仓库" className="git-tag-field h-8 min-w-0 flex-1 text-xs"><SelectValue placeholder="选择远程仓库" /></SelectTrigger><SelectContent>{info?.remotes.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select></div>}
          <label className="flex items-center gap-2"><Checkbox className="git-tag-check" checked={prune} onCheckedChange={(value) => setPrune(value === true)} />删除远端已不存在的跟踪分支</label>
          <label className="flex items-center gap-2"><Checkbox className="git-tag-check" checked={tags} onCheckedChange={(value) => setTags(value === true)} />抓取并在本地存储所有标签</label>
          {!info && !error && <p role="status" className="text-muted-foreground">正在读取仓库…</p>}
          {info && !info.remotes.length && <p role="alert" className="text-amber-600">请先在仓库设置中添加远程仓库。</p>}
        </fieldset>
        {error && <p role="alert" className="whitespace-pre-wrap break-words px-4 pb-3 text-xs text-red-600">{error}</p>}
        <RemoteDialogFooter><Button type="button" variant="outline" size="sm" className="git-tag-cancel h-8 text-xs" onClick={onClose}>取消</Button><Button type="submit" size="sm" className="git-tag-submit h-8 min-w-16 text-xs" disabled={!info?.remotes.length || (!all && !remote)}>确定</Button></RemoteDialogFooter>
      </form>}
    </GitPageDialogContent>
  </GitPageDialog>
}
