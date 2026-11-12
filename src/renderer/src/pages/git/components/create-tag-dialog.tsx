import "./create-tag-dialog.css"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CheckField } from "./git-check-field"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronDown, GitCommitHorizontal, Tag, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import type { GitCommitItem } from "@vessel/type"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import { toast } from "sonner"

const MODES = [{ value: "add", label: "添加标签", icon: Tag }, { value: "delete", label: "删除标签", icon: Trash2 }] as const

/** Tag operations at the history selection, with explicit opt-in remote publishing. */
export function CreateTagDialog({ repoPath, hash, onClose, onCreated }: { repoPath: string; hash: string; onClose: () => void; onCreated: () => Promise<void> }) {
  const [mode, setMode] = useState<"add" | "delete">("add")
  const [name, setName] = useState("")
  const [tagMenu, setTagMenu] = useState(false)
  const [target, setTarget] = useState(hash)
  const [head, setHead] = useState(false)
  const [pick, setPick] = useState(false)
  const [commits, setCommits] = useState<GitCommitItem[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [remotes, setRemotes] = useState<string[]>([])
  const [remote, setRemote] = useState("")
  const [push, setPush] = useState(false)
  const [removeRemote, setRemoveRemote] = useState(false)
  const [force, setForce] = useState(false)
  const [lightweight, setLightweight] = useState(false)
  const [sign, setSign] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [localDone, setLocalDone] = useState(false)
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
  const tag = name.trim()
  const exists = tags.includes(tag)
  const locked = busy || localDone
  const conflict = mode === "add" && exists && !force && !localDone
  const missing = mode === "delete" && !!tag && !exists && !localDone
  const invalid = !tag || conflict || missing || (mode === "add" && ((!head && !target.trim()) || (push && !remote)))
  const switchMode = (value: "add" | "delete") => {
    if (locked || value === mode) return
    setMode(value); setName(""); setError(""); setPick(false)
  }
  const submit = async () => {
    if (busy || invalid) return
    setBusy(true)
    setError("")
    try {
      if (mode === "delete") {
        if (!localDone) {
          await window.electronAPI.git.deleteTag(repoPath, tag)
          setLocalDone(true)
        }
        if (removeRemote) {
          const results = await Promise.allSettled(remotes.map((item) => window.electronAPI.git.deleteRemoteTag(repoPath, item, tag)))
          const failed = results.flatMap((result, index) => result.status === "rejected" ? [`${remotes[index]}：${cleanGitErrorMessage(result.reason)}`] : [])
          if (failed.length) {
            setError(`本地标签已删除，远程删除失败：${failed.join("；")}。可重试或取消关闭。`)
            await onCreated()
            return
          }
        }
        toast.success(removeRemote ? `已从本地和远程删除标签：${tag}` : `已删除本地标签：${tag}`)
      } else {
        if (!localDone) {
          await window.electronAPI.git.createTag(repoPath, tag, head ? "HEAD" : target.trim(), { force, lightweight, sign, message })
          setLocalDone(true)
        }
        if (push) {
          try { await window.electronAPI.git.pushTag(repoPath, remote, tag) }
          catch (reason) {
            setError(`本地标签已创建，推送失败：${cleanGitErrorMessage(reason)}。可重试推送或取消关闭。`)
            await onCreated()
            return
          }
        }
        toast.success(push ? `已创建并推送标签：${tag}` : `已创建标签：${tag}`)
      }
      await onCreated()
      onClose()
    } catch (reason) { setError(cleanGitErrorMessage(reason)) }
    finally { setBusy(false) }
  }
  const pickedCommit = commits.find((commit) => commit.hash === target.trim())
  const submitLabel = busy ? "正在处理…" : mode === "delete" ? (localDone ? "重试远程删除" : "删除") : localDone && push ? "重试推送" : "添加"
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent showCloseButton={false} className="git-dialog git-tag-dialog flex max-h-[90vh] max-w-[460px] flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200/80 px-5 py-3.5 dark:border-stone-700/70">
          <DialogHeader className="min-w-0 space-y-0.5 text-left">
            <DialogTitle className="text-[15px] font-semibold">{mode === "add" ? "添加标签" : "删除标签"}</DialogTitle>
            <DialogDescription className="truncate text-xs">{mode === "add" ? `在提交 ${hash.slice(0, 7)} 或其他提交上创建标签` : "移除本地标签，可选同步删除远程标签"}</DialogDescription>
          </DialogHeader>
          <div role="tablist" aria-label="标签操作" className="git-tag-mode flex shrink-0 gap-0.5 rounded-lg bg-stone-100 p-0.5 dark:bg-white/5">
            {MODES.map(({ value, label, icon: Icon }) => <button key={value} type="button" role="tab" aria-selected={mode === value} data-active={mode === value} disabled={locked && mode !== value} onClick={() => switchMode(value)} className="git-tag-ghost flex w-[58px] flex-col items-center gap-0.5 rounded-md py-1 text-[10px] text-stone-500 transition-colors disabled:opacity-40 dark:text-stone-400">
              <Icon className="size-3.5" />{label}
            </button>)}
          </div>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-xs">
            <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
              <label htmlFor="tag-name" className="text-right text-stone-500 dark:text-stone-400">标签名称</label>
              <Popover open={tagMenu && !locked} onOpenChange={setTagMenu}>
                <PopoverAnchor asChild>
                  <div className="relative">
                    <Input id="tag-name" autoFocus autoComplete="off" spellCheck={false} placeholder={mode === "add" ? "例如 v1.0.3" : tags.length ? "输入或选择标签" : "暂无本地标签"} value={name} disabled={locked} onChange={(event) => setName(event.target.value)} className="h-8 pr-8 font-mono text-xs md:text-xs" />
                    <PopoverTrigger asChild>
                      <button type="button" aria-label="选择已有标签" disabled={locked || !tags.length} className="git-tag-ghost absolute right-1 top-1 grid size-6 place-items-center rounded text-stone-400 disabled:opacity-40"><ChevronDown className="size-3.5" /></button>
                    </PopoverTrigger>
                  </div>
                </PopoverAnchor>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0" onOpenAutoFocus={(event) => event.preventDefault()}>
                  <Command>
                    <CommandInput placeholder="搜索标签…" className="text-xs" />
                    <ScrollArea className="[&_[data-radix-scroll-area-viewport]]:max-h-48">
                      <CommandList className="max-h-none overflow-visible">
                        <CommandEmpty className="py-4 text-center text-xs text-stone-400">没有匹配的标签</CommandEmpty>
                        {tags.map((item) => <CommandItem key={item} value={item} className="font-mono text-xs" onSelect={() => { setName(item); setTagMenu(false) }}><Check className={item === tag ? "opacity-100" : "opacity-0"} />{item}</CommandItem>)}
                      </CommandList>
                    </ScrollArea>
                  </Command>
                </PopoverContent>
              </Popover>
              {(conflict || missing) && <p className="col-start-2 -mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">{conflict ? "标签已存在，可在高级选项中勾选「移动现有标签」覆盖" : "本地不存在该标签"}</p>}

              {mode === "add" ? <>
                <span className="self-start pt-0.5 text-right text-stone-500 dark:text-stone-400">提交</span>
                <div className="space-y-2">
                  <RadioGroup value={head ? "head" : "commit"} onValueChange={(value) => setHead(value === "head")} disabled={locked} aria-label="目标提交方式" className="gap-2">
                    <div className="flex items-center gap-2"><RadioGroupItem id="tag-head" value="head" className="git-tag-radio size-4 border-stone-300 text-green-600 data-[state=checked]:border-green-600 dark:border-stone-600" /><label htmlFor="tag-head" className="cursor-pointer">工作副本父节点（HEAD）</label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem id="tag-commit" value="commit" className="git-tag-radio size-4 border-stone-300 text-green-600 data-[state=checked]:border-green-600 dark:border-stone-600" /><label htmlFor="tag-commit" className="cursor-pointer">指定的提交</label></div>
                  </RadioGroup>
                  <div className="flex gap-1.5 pl-6">
                    <Input aria-label="目标提交" spellCheck={false} value={target} disabled={locked || head} onChange={(event) => setTarget(event.target.value)} className="h-8 font-mono text-xs md:text-xs" />
                    <Popover open={pick && !head && !locked} onOpenChange={setPick}>
                      <PopoverTrigger asChild><Button type="button" variant="outline" className="git-tag-ghost h-8 shrink-0 gap-1 px-2.5 text-xs" disabled={locked || head}><GitCommitHorizontal className="size-3.5" />挑选</Button></PopoverTrigger>
                      <PopoverContent align="end" className="w-80 p-0">
                        <Command>
                          <CommandInput placeholder="搜索提交信息或 SHA…" className="text-xs" />
                          <CommandList className="max-h-60">
                            <CommandEmpty className="py-4 text-center text-xs text-stone-400">没有匹配的提交</CommandEmpty>
                            {commits.map((commit) => <CommandItem key={commit.hash} value={`${commit.hash} ${commit.message}`} className="gap-2 text-xs" onSelect={() => { setTarget(commit.hash); setPick(false) }}><code className="shrink-0 text-stone-400">{commit.shortHash}</code><span className="truncate">{commit.message}</span></CommandItem>)}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {!head && pickedCommit && <p className="truncate pl-6 text-[11px] text-stone-400">{pickedCommit.message}</p>}
                </div>

                <span className="text-right text-stone-500 dark:text-stone-400">推送</span>
                <div className="flex min-w-0 items-center gap-2">
                  <CheckField id="tag-push" checked={push} disabled={busy || !remotes.length} onChange={setPush}>推送到</CheckField>
                  <Select value={remote} onValueChange={(value) => { if (value) setRemote(value) }} disabled={busy || !push}>
                    <SelectTrigger aria-label="推送目标仓库" className="git-tag-field h-8 min-w-0 flex-1 text-xs"><SelectValue placeholder="没有远程仓库" /></SelectTrigger>
                    <SelectContent>{remotes.map((item) => <SelectItem key={item} value={item} className="text-xs">{item}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </> : <>
                <span className="text-right text-stone-500 dark:text-stone-400">远程</span>
                <CheckField id="tag-remove-remote" checked={removeRemote} disabled={busy || !remotes.length} onChange={setRemoveRemote}>
                  {remotes.length ? `同时从所有远程仓库删除（${remotes.join("、")}）` : "没有远程仓库"}
                </CheckField>
              </>}
            </div>

            {mode === "add" && <Collapsible defaultOpen={false}>
              <CollapsibleTrigger type="button" className="git-tag-advanced group flex items-center gap-1.5 py-1 text-stone-500 dark:text-stone-400"><ChevronDown className="size-3.5 -rotate-90 transition-transform group-data-[state=open]:rotate-0" />高级选项</CollapsibleTrigger>
              <CollapsibleContent>
                <fieldset disabled={locked} className="mt-1.5 space-y-2.5 rounded-lg border border-stone-200/80 bg-stone-50/60 p-3 dark:border-stone-700/70 dark:bg-white/[.03]">
                  <CheckField id="tag-force" checked={force} disabled={locked} onChange={setForce}>移动现有标签</CheckField>
                  <CheckField id="tag-lightweight" checked={lightweight} disabled={locked} onChange={(value) => { setLightweight(value); if (value) setSign(false) }}>轻量标签<span className="ml-1 text-stone-400">（不含说明，不推荐）</span></CheckField>
                  <CheckField id="tag-sign" checked={sign} disabled={locked || lightweight} onChange={setSign}>对标签签名<span className="ml-1 text-stone-400">（使用仓库配置的密钥）</span></CheckField>
                  <div className="space-y-1.5 pt-0.5">
                    <label htmlFor="tag-message" className={lightweight ? "text-stone-400" : ""}>标签说明</label>
                    <Textarea id="tag-message" disabled={locked || lightweight} value={message} placeholder="留空时使用标签名称" onChange={(event) => setMessage(event.target.value)} className="min-h-14 resize-none bg-background text-xs md:text-xs" />
                  </div>
                </fieldset>
              </CollapsibleContent>
            </Collapsible>}
            {error && <p role="alert" className="rounded-md bg-red-50 px-2.5 py-2 text-[11px] text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-stone-200/80 px-5 py-3 dark:border-stone-700/70">
            <Button type="button" variant="outline" size="sm" className="git-tag-cancel h-8 text-xs" disabled={busy} onClick={onClose}>取消</Button>
            <Button type="submit" size="sm" className={`h-8 min-w-16 text-xs ${mode === "delete" ? "git-tag-danger" : "git-tag-submit"}`} disabled={busy || invalid}>{submitLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
