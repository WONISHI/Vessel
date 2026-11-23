import "./create-tag-dialog.css"
import { GitOperationLoading } from "./operation-loading"
import { Upload } from "lucide-react"
import { PushBranchInput } from "./push-branch-input"
import { useEffect, useState } from "react"
import type { GitPushInfo, GitPushSelection } from "@vessel/type/git"
import { GitPageDialog, GitPageDialogContent } from "./git-page-dialog"
import { RemoteDialogFooter, RemoteDialogHeader } from "./remote-dialog-layout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import { toast } from "@/components/ui/sonner"

type Row = { local: string; remote: string; track: boolean; selected: boolean }

export function PushDialog({ repoPath, initialRemote, initialBranch, onClose, onPush, onCancel }: { repoPath: string; initialRemote?: string; initialBranch?: string; onClose: () => void; onPush: (selection: GitPushSelection) => Promise<void>; onCancel?: () => Promise<boolean> }) {
  const [info, setInfo] = useState<GitPushInfo>()
  const [remote, setRemote] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [tags, setTags] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState("")
  const remoteBranches = [...new Set(info?.remoteBranches.filter((branch) => branch.startsWith(`${remote}/`)).map((branch) => branch.slice(remote.length + 1)) ?? [])]
  useEffect(() => {
    let alive = true
    void window.electronAPI.git.getPushInfo(repoPath).then((value) => {
      if (!alive) return
      const current = value.branches.find((branch) => branch.current)
      const preferred = initialRemote || current?.upstreamRemote || "origin"
      const target = value.remotes.find((item) => item.name === preferred)?.name || value.remotes[0]?.name || ""
      setInfo(value)
      setRemote(target)
      setRows(value.branches.map((branch) => ({ local: branch.name, remote: branch.upstreamRemote === target ? branch.upstreamBranch || branch.name : branch.name, track: !branch.upstreamRemote || branch.upstreamRemote === target, selected: initialBranch ? branch.name === initialBranch : branch.current })))
    }).catch((reason) => { if (alive) setError(cleanGitErrorMessage(reason)) })
    return () => { alive = false }
  }, [repoPath, initialRemote, initialBranch])
  const patch = (local: string, value: Partial<Row>) => setRows((previous) => previous.map((row) => row.local === local ? { ...row, ...value } : row))
  const changeRemote = (value: string) => {
    if (!value) return
    setRemote(value)
    setRows((previous) => previous.map((row) => {
      const branch = info?.branches.find((branch) => branch.name === row.local)
      return { ...row, remote: branch?.upstreamRemote === value ? branch.upstreamBranch || row.local : row.local, track: !branch?.upstreamRemote || branch.upstreamRemote === value }
    }))
  }
  const submit = async () => {
    if (busy || !remote) return
    setBusy(true)
    setError("")
    try {
      await onPush({ remote, branches: rows.filter((row) => row.selected).map(({ local, remote, track }) => ({ local, remote: remote.trim(), track })), tags })
      onClose()
    } catch (reason) {
      const message = cleanGitErrorMessage(reason)
      if (message === "推送已取消") onClose()
      else toast.error(message)
    }
    finally { setBusy(false); setCancelling(false) }
  }
  const cancel = async () => {
    if (!onCancel || cancelling) return
    setCancelling(true)
    try { if (!await onCancel()) setCancelling(false) }
    catch (reason) { setCancelling(false); toast.error(cleanGitErrorMessage(reason)) }
  }
  return <GitPageDialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <GitPageDialogContent showCloseButton={!busy} className={`git-dialog git-tag-dialog flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 ${busy ? "max-w-[320px] border-0" : "max-w-[460px]"}`} onInteractOutside={(event) => { if (busy) event.preventDefault() }}>
      <RemoteDialogHeader hidden={busy} icon={<Upload className="size-4" />} title="推送分支" description="选择远程仓库与本地分支，可修改目标分支名称并设置跟踪。" />
      {busy ? <GitOperationLoading inline operation="push" repoPath={repoPath} onCancel={onCancel ? () => { void cancel() } : undefined} cancelling={cancelling} branch={rows.filter((row) => row.selected).map((row) => row.local).join(", ")} /> : <form className="flex min-h-0 min-w-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <fieldset disabled={busy} className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex min-w-0 items-center gap-2 text-xs"><span className="shrink-0">推送到仓库</span>
            <Select value={remote} onValueChange={changeRemote} disabled={!info?.remotes.length}><SelectTrigger aria-label="推送到仓库" className="h-8 w-28 shrink-0 text-xs"><SelectValue placeholder="无远程仓库" /></SelectTrigger><SelectContent>{info?.remotes.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select>
            <Input aria-label="远程仓库地址" disabled value={info?.remotes.find((item) => item.name === remote)?.url || ""} className="h-8 min-w-0 flex-1 bg-stone-100 text-xs text-muted-foreground disabled:opacity-100 dark:bg-stone-800" />
          </div>
          <div className="overflow-hidden rounded-lg border border-stone-200/80 dark:border-stone-700/70">
            <ScrollArea horizontal className="max-h-[min(36vh,260px)] [&_[data-radix-scroll-area-viewport]]:max-h-[min(36vh,260px)] [&_[data-radix-scroll-area-viewport]>div]:!block">
              <table className="w-full min-w-[380px] text-left text-xs"><thead className="sticky top-0 bg-stone-50 dark:bg-stone-900"><tr>{["推送", "本地分支", "远程分支", "跟踪"].map((title) => <th key={title} className="border-b border-stone-200/80 px-3 py-2 font-medium text-stone-500 dark:border-stone-700/70 dark:text-stone-400">{title}</th>)}</tr></thead>
                <tbody>{rows.map((row) => <tr key={row.local} className="border-b border-stone-200/60 last:border-b-0 dark:border-stone-700/50">
                  <td className="px-3 py-1.5"><Checkbox className="rounded-[3px] data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=indeterminate]:border-green-600 data-[state=indeterminate]:bg-green-600 data-[state=indeterminate]:text-white" aria-label={`推送分支 ${row.local}`} checked={row.selected} disabled={busy} onCheckedChange={(checked) => patch(row.local, { selected: checked === true })} /></td>
                  <td className="px-3 py-1.5">{row.local}</td>
                  <td className="px-3 py-1.5"><PushBranchInput label={`${row.local} 的远程分支`} value={row.remote} options={remoteBranches} disabled={busy} onChange={(remote) => patch(row.local, { remote })} /></td>
                  <td className="px-3 py-1.5"><Checkbox className="rounded-[3px] data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=indeterminate]:border-green-600 data-[state=indeterminate]:bg-green-600 data-[state=indeterminate]:text-white" aria-label={`跟踪分支 ${row.local}`} checked={row.track} disabled={busy} onCheckedChange={(checked) => patch(row.local, { track: checked === true })} /></td>
                </tr>)}</tbody>
              </table>
              {!info && !error && <p role="status" className="p-4 text-xs text-muted-foreground">正在读取分支…</p>}
              {info && !rows.length && <p className="p-4 text-xs text-muted-foreground">暂无可推送的本地分支</p>}
            </ScrollArea>
            <label className="flex items-center gap-2 border-t border-stone-200/80 px-3 py-2 text-xs dark:border-stone-700/70"><Checkbox className="rounded-[3px] data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=indeterminate]:border-green-600 data-[state=indeterminate]:bg-green-600 data-[state=indeterminate]:text-white" checked={rows.length > 0 && rows.every((row) => row.selected) ? true : rows.some((row) => row.selected) ? "indeterminate" : false} disabled={busy || !rows.length} onCheckedChange={(checked) => setRows((rows) => rows.map((row) => ({ ...row, selected: checked === true })))} />全选分支</label>
          </div>

          <label className="flex items-center gap-2 text-xs"><Checkbox className="rounded-[3px] data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=indeterminate]:border-green-600 data-[state=indeterminate]:bg-green-600 data-[state=indeterminate]:text-white" checked={tags} disabled={busy} onCheckedChange={(checked) => setTags(checked === true)} />推送所有标签</label>
        </fieldset>
        {info && !info.remotes.length && <p role="alert" className="px-5 pb-3 text-xs text-amber-600">请先在仓库设置中添加远程仓库。</p>}
        {error && <p role="alert" className="whitespace-pre-wrap break-words px-5 pb-3 text-xs text-red-600">{error}</p>}
        <RemoteDialogFooter><Button type="button" variant="outline" size="sm" className="git-tag-cancel h-8 text-xs" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" size="sm" className="git-tag-submit h-8 min-w-16 text-xs" disabled={busy || !remote || (!tags && !rows.some((row) => row.selected)) || rows.some((row) => row.selected && !row.remote.trim())}>{busy ? "正在推送…" : "确定"}</Button></RemoteDialogFooter>
      </form>}
    </GitPageDialogContent>
  </GitPageDialog>
}
