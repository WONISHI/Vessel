import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { AlertTriangle, Check, CodeXml, File } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** Unmerged index entries stay separate until the user explicitly resolves them. */
export function GitConflictFiles({ g }: { g: GitPageModel }) {
  const files = g.status?.conflicts || []
  const selected = g.selectedConflictPaths.filter((path) => files.some((file) => file.path === path))
  const resolve = () => void g.handleResolveConflicts(selected)
  return <>
    <div data-git-conflict-header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">
      <span className="flex min-w-0 items-center gap-1.5">
        <Checkbox aria-label="全选冲突文件" checked={files.length > 0 && selected.length === files.length ? true : selected.length ? "indeterminate" : false} onCheckedChange={(checked) => {
          g.setActiveFileSection("conflicts")
          g.setSelectedStagedPaths([])
          g.setSelectedUnstagedPaths([])
          g.setSelectedConflictPaths(checked === true ? files.map((file) => file.path) : [])
        }} />
        <AlertTriangle className="size-3.5 shrink-0" />
        <span className="truncate">冲突文件 (Conflicts)</span>
        <span className="rounded-full bg-red-100 px-1.5 text-[10px]">{files.length}</span>
      </span>
      <button type="button" disabled={!selected.length || g.resolvingConflicts} onClick={resolve} className="shrink-0 whitespace-nowrap text-[11px] font-normal hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
        {g.resolvingConflicts ? "正在暂存…" : `标记解决并暂存所选 (${selected.length})`}
      </button>
    </div>
    <p className="shrink-0 border-b border-stone-200 px-3 py-1 text-[10px] text-stone-500">在编辑器中修复并保存，再选中文件标记解决并暂存。</p>
    <ScrollArea className="git-changes-scroll min-h-0 min-w-0 flex-1 p-1">
      <div role="listbox" aria-label="冲突文件" aria-multiselectable="true" className="space-y-0.5">
        {files.map((file, index) => <ContextMenu key={file.path}>
          <ContextMenuTrigger asChild>
            <div role="option" aria-selected={selected.includes(file.path)} tabIndex={0} data-git-file-selected={selected.includes(file.path)}
              className={`group flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs ${selected.includes(file.path) ? "bg-stone-200 text-stone-900" : "text-stone-700 hover:bg-stone-100"}`}
              onClick={(event) => g.handleConflictItemClick(event, file, index)} onContextMenu={() => g.handleConflictContextMenu(file, index)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); g.handleConflictChecked(file, index, !selected.includes(file.path)) } }}>
              <Checkbox aria-label={`选择冲突文件 ${file.path}`} checked={selected.includes(file.path)} onClick={(event) => event.stopPropagation()} onCheckedChange={(checked) => g.handleConflictChecked(file, index, checked === true)} onKeyDown={(event) => event.stopPropagation()} />
              <File className="size-3.5 shrink-0 text-red-500" />
              <span className="shrink-0 font-bold text-red-600" aria-label="未解决冲突">U</span>
              <span className="min-w-0 flex-1 truncate" data-title={file.path}>{file.path}</span>
              <button type="button" aria-label={`在编辑器中修复 ${file.path}`} data-title="在编辑器中修复" className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700" onClick={(event) => { event.stopPropagation(); void g.handleOpenInEditor(file.path) }} onKeyDown={(event) => event.stopPropagation()}><CodeXml className="size-3.5" /></button>
              <button type="button" aria-label={`标记 ${file.path} 为已解决并暂存`} disabled={g.resolvingConflicts} data-title="标记为已解决并暂存" className="shrink-0 rounded p-1 text-green-700 hover:bg-green-100 disabled:opacity-40" onClick={(event) => { event.stopPropagation(); void g.handleResolveConflicts([file.path]) }} onKeyDown={(event) => event.stopPropagation()}><Check className="size-3.5" /></button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => void g.handleOpenInEditor(file.path)}><CodeXml />在编辑器中修复</ContextMenuItem>
            <ContextMenuItem disabled={g.resolvingConflicts} onSelect={() => void g.handleResolveConflicts(selected.includes(file.path) ? selected : [file.path])}><Check />标记为已解决并暂存</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>)}
      </div>
    </ScrollArea>
  </>
}
