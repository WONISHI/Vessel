import { useEffect, useState } from "react"
import type { GitCommitItem } from "@vessel/type"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import { toast } from "sonner"

/** Tag operations at the history selection, with explicit opt-in remote publishing. */
export function CreateTagDialog({ repoPath, hash, onClose, onCreated }: { repoPath: string; hash: string; onClose: () => void; onCreated: () => Promise<void> }) {
  const [mode, setMode] = useState<"add" | "delete">("add")
  const [name, setName] = useState("")
  const [target, setTarget] = useState(hash)
  const [head, setHead] = useState(false)
  const [pick, setPick] = useState(false)
  const [query, setQuery] = useState("")
  const [commits, setCommits] = useState<GitCommitItem[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [remotes, setRemotes] = useState<string[]>([])
  const [remote, setRemote] = useState("")
  const [push, setPush] = useState(false)
  const [force, setForce] = useState(false)
  const [lightweight, setLightweight] = useState(false)
  const [sign, setSign] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [localCreated, setLocalCreated] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void Promise.all([window.electronAPI.git.getRepositorySettings(repoPath), window.electronAPI.git.getTags(repoPath), window.electronAPI.git.getLog(repoPath, 100, 0, true)]).then(([settings, tags, log]) => {
      if (!active) return
      const names = settings.remotes.map((item) => item.name)
      setRemotes(names)
      setRemote(names.includes("origin") ? "origin" : names[0] ?? "")
      setTags(tags)
      setCommits(log)
    }).catch((reason) => { if (active) setError(cleanGitErrorMessage(reason)) })
    return () => { active = false }
  }, [repoPath])
  const submit = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    setError("")
    try {
      if (mode === "delete") {
        await window.electronAPI.git.deleteTag(repoPath, name)
        toast.success(`已删除本地标签：${name}`)
      } else {
        if (!localCreated) {
          await window.electronAPI.git.createTag(repoPath, name.trim(), head ? "HEAD" : target.trim(), { force, lightweight, sign, message })
          setLocalCreated(true)
        }
        if (push) {
          try { await window.electronAPI.git.pushTag(repoPath, remote, name.trim()) }
          catch (reason) {
            setError(`本地标签已创建，推送失败：${cleanGitErrorMessage(reason)}。可重试推送或取消关闭。`)
            await onCreated()
            return
          }
        }
        toast.success(push ? `已创建并推送标签：${name.trim()}` : `已创建标签：${name.trim()}`)
      }
      await onCreated()
      onClose()
    } catch (reason) { setError(cleanGitErrorMessage(reason)) }
    finally { setBusy(false) }
  }
  const locked = busy || localCreated
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent className="git-dialog max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "添加标签" : "删除标签"}</DialogTitle>
          <DialogDescription>{mode === "add" ? `为提交 ${hash.slice(0, 7)} 或指定提交创建标签。` : "删除本地标签，不影响远程仓库的标签。"}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-800" aria-label="标签操作">
          {([ ["add", "添加标签"], ["delete", "删除标签"] ] as const).map(([value, label]) => (
            <Button key={value} type="button" variant={mode === value ? "secondary" : "ghost"} disabled={locked} aria-pressed={mode === value} onClick={() => { setMode(value); setName(""); setError(""); setPick(false) }}>{label}</Button>
          ))}
        </div>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <label className="flex items-center gap-3 text-sm"><span className="w-20 shrink-0">标签名称</span>
            {mode === "add" ? <Input autoFocus aria-label="标签名称" placeholder="例如 v1.0.3" value={name} disabled={locked} onChange={(event) => setName(event.target.value)} /> :
              <Select value={name} onValueChange={setName} disabled={busy || !tags.length}><SelectTrigger aria-label="选择要删除的标签"><SelectValue placeholder={tags.length ? "选择标签" : "暂无本地标签"} /></SelectTrigger><SelectContent>{tags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}</SelectContent></Select>}
          </label>
          {mode === "add" && <>
            <fieldset disabled={locked} className="space-y-2 text-sm">
              <legend className="mb-2">提交</legend>
              <label className="flex items-center gap-2"><input type="radio" name="tag-commit" checked={head} onChange={() => setHead(true)} />工作副本父节点（HEAD）</label>
              <label className="flex items-center gap-2"><input type="radio" name="tag-commit" checked={!head} onChange={() => setHead(false)} />指定的提交</label>
              <div className="flex gap-2 pl-6"><Input aria-label="目标提交" value={target} disabled={locked || head} onChange={(event) => setTarget(event.target.value)} /><Button type="button" variant="outline" disabled={locked || head} onClick={() => setPick(!pick)}>挑选…</Button></div>
              {pick && !head && <div className="space-y-2 rounded-lg border p-2">
                <Input aria-label="筛选提交" placeholder="搜索提交信息或 SHA…" value={query} onChange={(event) => setQuery(event.target.value)} />
                <div className="max-h-36 overflow-y-auto">{commits.filter((commit) => `${commit.hash} ${commit.message}`.toLowerCase().includes(query.toLowerCase())).map((commit) => <button type="button" key={commit.hash} className="flex w-full gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-stone-800" onClick={() => { setTarget(commit.hash); setPick(false) }}><code className="shrink-0 text-stone-400">{commit.shortHash}</code><span className="truncate">{commit.message}</span></button>)}</div>
              </div>}
            </fieldset>
            <div className="flex items-center gap-3 text-sm"><label className="flex shrink-0 items-center gap-2"><input type="checkbox" checked={push} disabled={busy || !remotes.length} onChange={(event) => setPush(event.target.checked)} />推送标签</label>
              <Select value={remote} onValueChange={setRemote} disabled={busy || !push}><SelectTrigger aria-label="推送目标仓库"><SelectValue placeholder="没有远程仓库" /></SelectTrigger><SelectContent>{remotes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            </div>
            <details className="text-sm" open>
              <summary className="cursor-pointer py-1">高级选项</summary>
              <fieldset disabled={locked} className="mt-2 space-y-3 rounded-lg border bg-stone-50/50 p-4 dark:bg-stone-900/30">
                <label className="flex items-center gap-2"><input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />移动现有标签</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={lightweight} onChange={(event) => { setLightweight(event.target.checked); if (event.target.checked) setSign(false) }} />轻量标签</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sign} disabled={locked || lightweight} onChange={(event) => setSign(event.target.checked)} />对标签签名（使用仓库配置的密钥）</label>
                <label className="block space-y-2"><span>标签说明</span><Textarea aria-label="标签说明" disabled={locked || lightweight} value={message} placeholder="留空时使用标签名称" onChange={(event) => setMessage(event.target.value)} className="min-h-16" /></label>
              </fieldset>
            </details>
          </>}
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>取消</Button>
            <Button type="submit" disabled={busy || !name.trim() || (mode === "add" && ((!head && !target.trim()) || (push && !remote)))}>{busy ? "正在处理…" : mode === "delete" ? "删除" : localCreated && push ? "重试推送" : "添加"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
