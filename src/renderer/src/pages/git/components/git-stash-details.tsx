import { GitStashContentCheckPanel } from "./git-stash-content-check"
import { ArchiveRestore, Copy, File, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable-panels"
import { DiffViewer } from "./diff-viewer"
import { FileChangeStatus } from "./file-change-status"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

export function GitStashDetails({ g }: { g: GitPageModel }) {
  const selected = g.selectedStash
  if (!selected) return <div className="flex flex-1 items-center justify-center text-xs text-stone-400">点击左侧贮藏记录查看文件</div>
  const record = g.stashes.find((entry) => selected.hash && entry.hash ? entry.hash === selected.hash : entry.index === selected.index)
  const disabled = !record || g.restoringStash
  const createdAt = record?.date || selected.date
  const created = createdAt ? new Date(createdAt) : null
  const createdTime = created && Number.isFinite(created.getTime()) ? created : null
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-3 py-2">
      <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold" data-title={selected.name}>贮藏 #{record?.index ?? selected.index} · {selected.name}</div><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-stone-500"><span>保存的文件：{g.stashDetail?.files.length ?? 0}</span><span>贮藏时间：{createdTime ? <time dateTime={createdAt}>{createdTime.toLocaleString("zh-CN", { hour12: false })}</time> : "未知"}</span>{!record && <span>此记录已删除</span>}</p></div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => record && void g.handleStashApply(record.index)} className="h-7 text-[11px]"><Copy className="size-3" />应用并保留</Button>
        <Button size="sm" variant="outline" disabled={disabled} data-title="合并恢复；成功后删除记录，冲突时保留；本地修改重叠时停止" onClick={() => record && void g.handleStashPop(record.index)} className="h-7 text-[11px]"><ArchiveRestore className="size-3" />弹出贮藏</Button>
        <Button size="icon" variant="ghost" aria-label="删除当前贮藏" disabled={disabled} onClick={() => record && void g.handleStashDrop(record.index)} className="size-7 text-red-600"><Trash2 className="size-3.5" /></Button>
      </div>
    </header>
    {record?.lastRestore && <p className="shrink-0 border-b px-3 py-1.5 text-[11px] text-stone-500">Vessel 记录：{record.lastRestore.outcome === "conflicts" ? "恢复时有冲突" : "已恢复过"} · {new Date(record.lastRestore.at).toLocaleString("zh-CN", { hour12: false })} · 分支 {record.lastRestore.branch || "游离 HEAD"}</p>}
    <GitStashContentCheckPanel key={`${g.repoPath}:${g.stashDetail?.hash || selected.hash || selected.index}`} root={g.repoPath} hash={g.stashDetail?.hash || selected.hash} />
    <p className="shrink-0 border-b border-stone-200 px-3 py-1.5 text-[10px] text-stone-500">恢复时合并变更；本地修改与贮藏路径重叠时停止，冲突时保留贮藏并手动处理。</p>
    {g.stashError ? <p role="alert" className="p-4 text-xs text-red-600">{g.stashError}</p> : g.stashLoading ? <p role="status" className="p-4 text-xs text-stone-500">正在读取贮藏文件…</p> : <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel id="git-stash-files" defaultSize="38%" minSize="20%" maxSize="65%" className="flex min-h-0 min-w-0 flex-col">
        <ScrollArea className="min-h-0 flex-1 p-2">
          {g.stashDetail?.files.map((file) => <button key={file.path} type="button" data-git-selected={g.selectedStashFile?.path === file.path} aria-pressed={g.selectedStashFile?.path === file.path} onClick={() => g.selectStashFile(file)} className={`mb-0.5 flex w-full min-w-0 items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs ${g.selectedStashFile?.path === file.path ? "bg-stone-200 text-stone-900" : "text-stone-700 hover:bg-stone-100"}`}>
            <File className={`size-3.5 shrink-0 ${getFilePresentation(file.path).color}`} /><span className="min-w-0 flex-1 truncate" data-title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>{file.path}</span>
            {file.source === "index" && <span className="shrink-0 text-[10px] text-stone-400">暂存区</span>}<FileChangeStatus status={file.status} />
          </button>)}
          {!g.stashDetail?.files.length && <p className="p-3 text-center text-xs text-stone-400">此贮藏中没有文件变更</p>}
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle aria-label="调整贮藏文件与差异区域宽度" />
      <ResizablePanel id="git-stash-diff" defaultSize="62%" minSize="35%" className="flex min-h-0 min-w-0 flex-col">
        {g.stashDiffError ? <p role="alert" className="p-4 text-xs text-red-600">{g.stashDiffError}</p> : g.stashDiffLoading ? <p role="status" className="p-4 text-xs text-stone-500">正在读取文件差异…</p> : <DiffViewer diffText={g.stashDiffText} filePath={g.selectedStashFile?.path} />}
      </ResizablePanel>
    </ResizablePanelGroup>}
  </div>
}
