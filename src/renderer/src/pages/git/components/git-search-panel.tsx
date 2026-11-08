import { GitSearchDate } from "./git-search-date"
import { calendarDateKey } from "@vessel/utils"
import { useEffect, useRef, useState } from "react"
import type { GitCommitDetail, GitCommitItem } from "@vessel/type"
import type { GitSearchOptions } from "@vessel/type/git"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable-panels"
import { GitCommitFiles } from "./git-commit-files"
import { DiffViewer } from "./diff-viewer"
import type { GitPageModel } from "../hooks/use-git-page"
import { cleanGitErrorMessage } from "../utils"

const fields = { message: "提交信息", sha: "提交 SHA", branch: "分支", file: "文件变更", author: "用户" } as const

export function GitSearchPanel({ g }: { g: GitPageModel }) {
  const [query, setQuery] = useState("")
  const [field, setField] = useState<GitSearchOptions["field"]>("message")
  const [from, setFrom] = useState("1980-01-01")
  const [to, setTo] = useState(() => calendarDateKey(new Date()))
  const [commits, setCommits] = useState<GitCommitItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<string>()
  const [detail, setDetail] = useState<GitCommitDetail | null>(null)
  const [diff, setDiff] = useState("")
  const generation = useRef(0)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const busy = useRef(false)
  const filters = { query, field, from: from || undefined, to: to || undefined }
  useEffect(() => {
    const version = ++generation.current
    busy.current = false
    setCommits([])
    setSelected(undefined)
    setDetail(null)
    setDiff("")
    setError("")
    setHasMore(false)
    setLoading(!!query.trim())
    if (!query.trim()) return
    const timer = setTimeout(() => {
      busy.current = true
      void window.electronAPI.git.searchCommits(g.repoPath, { ...filters, limit: 100 }).then((result) => {
        if (version !== generation.current) return
        setCommits(result.commits)
        setHasMore(result.hasMore)
        setSelected(result.commits[0]?.hash)
      }).catch((reason) => { if (version === generation.current) setError(cleanGitErrorMessage(reason)) })
        .finally(() => { if (version === generation.current) { setLoading(false); busy.current = false } })
    }, 250)
    return () => { clearTimeout(timer); ++generation.current }
  }, [g.repoPath, query, field, from, to])
  useEffect(() => {
    let active = true
    setDetail(null)
    setDiff("")
    if (!selected) return
    void window.electronAPI.git.getCommitDetail(g.repoPath, selected).then(async (value) => {
      if (!active) return
      setDetail(value)
      if (!value.files[0]) return
      const result = await window.electronAPI.git.getDiff(g.repoPath, value.files[0].path, false, selected)
      if (active) setDiff(result.diff)
    }).catch((reason) => { if (active) setError(cleanGitErrorMessage(reason)) })
    return () => { active = false }
  }, [g.repoPath, selected])
  const loadMore = async () => {
    if (busy.current || !hasMore) return
    busy.current = true
    setLoading(true)
    const version = generation.current
    try {
      const result = await window.electronAPI.git.searchCommits(g.repoPath, { ...filters, skip: commits.length, limit: 100 })
      if (version !== generation.current) return
      setCommits((previous) => [...previous, ...result.commits.filter((item) => !previous.some((existing) => existing.hash === item.hash))])
      setHasMore(result.hasMore)
      setError("")
    } catch (reason) { if (version === generation.current) setError(cleanGitErrorMessage(reason)) }
    finally { if (version === generation.current) { busy.current = false; setLoading(false) } }
  }
  const model: GitPageModel = { ...g, commitDetail: detail, setDiffText: (value) => {
    if (selectedRef.current === detail?.hash) setDiff(value)
  } }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="git-history-toolbar flex shrink-0 flex-wrap items-center gap-2 border-b bg-stone-50/70 p-2 text-xs dark:bg-[#20242a]">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
          <Input autoFocus type="text" aria-label="搜索 Git 提交" placeholder={`搜索${fields[field]}…`} value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 pl-7 pr-7 text-xs" />
          {query && <button type="button" aria-label="清空搜索" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400"><X className="size-3.5" /></button>}
        </div>
        <span className="text-stone-500">搜索：</span>
        <Select value={field} onValueChange={(value) => setField(value as GitSearchOptions["field"])}>
          <SelectTrigger aria-label="Git 搜索类型" className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(fields).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-1 text-stone-500"><span>从</span><GitSearchDate label="搜索起始日期" value={from} max={to} onChange={setFrom} /></div>
        <div className="flex items-center gap-1 text-stone-500"><span>至</span><GitSearchDate label="搜索结束日期" value={to} min={from} onChange={setTo} /></div>
      </div>
      {error && <p role="alert" className="px-3 py-2 text-xs text-red-600">{error}</p>}
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel id="git-search-results" defaultSize="60%" minSize="20%" className="flex min-h-0 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <div className="min-w-[650px] text-xs">
              <div className="git-history-table-header sticky top-0 z-10 flex gap-3 border-b bg-stone-100 px-3 py-2 text-stone-500 dark:bg-[#20242a]"><span className="min-w-0 flex-1">描述</span><span className="w-20">提交</span><span className="w-28">作者</span><span className="w-36">日期</span></div>
              {commits.map((commit) => <div key={commit.hash} role="button" tabIndex={0} aria-pressed={selected === commit.hash} data-git-history-selected={selected === commit.hash} onClick={() => setSelected(commit.hash)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(commit.hash) } }} className={`flex w-full cursor-pointer items-center gap-3 border-b border-stone-100 px-3 py-2 text-left transition-colors ${selected === commit.hash ? "bg-blue-50 text-blue-900 font-medium" : "hover:bg-stone-50 text-stone-700"}`}>
                <span className="min-w-0 flex-1 truncate" data-title={commit.message}>{commit.message}</span><code className="w-20 shrink-0 text-stone-400">{commit.shortHash}</code><span className="w-28 shrink-0 truncate text-stone-500" data-title={`${commit.author} <${commit.email}>`}>{commit.author}</span><span className="w-36 shrink-0 text-stone-400">{commit.date}</span>
              </div>)}
            </div>
            {!commits.length && <p role="status" className="p-8 text-center text-xs text-stone-400">{loading ? "正在搜索…" : query.trim() ? "没有匹配的提交" : "输入关键词搜索仓库的提交记录"}</p>}
            {!!commits.length && <div className="flex items-center justify-center gap-3 p-2 text-xs text-stone-400"><span role="status">已找到 {commits.length} 条{hasMore ? "，还有更多结果" : ""}</span>{hasMore && <Button variant="ghost" size="sm" disabled={loading} onClick={() => void loadMore()}>{loading ? "加载中…" : "加载更多"}</Button>}</div>}
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle aria-label="调整搜索结果与详情高度" />
        <ResizablePanel id="git-search-details" defaultSize="40%" minSize="15%" className="flex min-h-0">
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel id="git-search-files" defaultSize="35%" minSize="20%" className="flex min-h-0 flex-col"><GitCommitFiles g={model} /></ResizablePanel>
            <ResizableHandle aria-label="调整搜索提交文件与差异宽度" />
            <ResizablePanel id="git-search-diff" defaultSize="65%" minSize="25%" className="flex min-h-0 flex-col"><DiffViewer diffText={diff} filePath="Commit 差异对比" /></ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
