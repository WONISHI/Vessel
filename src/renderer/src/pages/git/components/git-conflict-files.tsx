import { matchesGitFilePath } from "../file-filter"
import { useGitChangesView } from "../hooks/use-git-changes-view"
import { GitChangesTree } from "./git-changes-tree"
import { GitChangesSearch } from "./git-changes-search"
import { GitChangesViewToggle } from "./git-changes-view-toggle"
import { gitFilePosition } from "../file-position"
import { useGitSelectionReveal } from "../hooks/use-git-selection-reveal"
import { GitFileIcon } from "./git-file-icon"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { AlertTriangle, Check, CheckCheck, CodeXml, Plus } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** Unmerged index entries stay separate until the user explicitly resolves them. */
export function GitConflictFiles({ g }: { g: GitPageModel }) {
  const files = g.status?.conflicts || []
  const { tree, toggleTree } = useGitChangesView("conflicts")
  const query = g.conflictFileQuery ?? ""
  const visibleFiles = files.filter(file => matchesGitFilePath(file.path, query))
  const selected = g.selectedConflictPaths.filter((path) => files.some((file) => file.path === path))
  const selectedPath = g.activeFileSection === "conflicts" && g.selectedFile && selected.includes(g.selectedFile.path) ? g.selectedFile.path : undefined
  const position = gitFilePosition(visibleFiles, selectedPath, tree)
  const selectionRoot = useGitSelectionReveal(g.repoPath, g.selectedFile?.path, g.activeFileSection === "conflicts", !!g.status)
  return <>
    <div data-git-conflict-header className="flex h-[41px] shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">
      <span className="flex min-w-0 items-center gap-1.5">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span className="truncate">冲突文件 (Conflicts)</span>
        <span aria-label="冲突文件位置" className="rounded-full bg-red-100 px-1.5 text-[10px] tabular-nums">{position}</span>
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
      <GitChangesViewToggle tree={tree} onToggle={toggleTree} label="冲突文件" />
      <GitChangesSearch key={g.repoPath} label="冲突文件" query={query} onChange={g.setConflictFileQuery} />
      <Button type="button" variant="ghost" size="icon" aria-label="全部标记为已解决并暂存" data-title="全部标记为已解决并暂存" data-title-side="bottom" className="git-changes-action size-7 rounded-lg" disabled={g.resolvingConflicts || !files.length} onClick={() => void g.handleResolveConflicts(files.map(file => file.path))}>
        <CheckCheck className="size-4" />
      </Button>
      </div>
    </div>
    <ScrollArea ref={selectionRoot} className="git-changes-scroll min-h-0 min-w-0 flex-1 p-1">
      <div role="listbox" aria-label="冲突文件" aria-multiselectable="true" className="space-y-0.5">
        <GitChangesTree key={g.repoPath} files={files} query={query} tree={tree} renderFile={(file, index, tree) => <ContextMenu key={file.path}>
          <ContextMenuTrigger asChild>
            <div role="option" data-git-change-path={file.path} style={tree ? { paddingLeft: "var(--git-tree-padding)" } : undefined} aria-selected={selected.includes(file.path)} tabIndex={0} data-git-file-selected={selected.includes(file.path)} data-git-primary-file={g.selectedFile?.path === file.path && selected.includes(file.path)}
              className={`group flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs ${selected.includes(file.path) ? "bg-stone-200 text-stone-900" : "text-stone-700 hover:bg-stone-100"}`}
              onClick={(event) => g.handleConflictItemClick(event, file, index)} onContextMenu={() => g.handleConflictContextMenu(file, index)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); g.handleConflictChecked(file, index, !selected.includes(file.path)) } }}>
              <GitFileIcon path={file.path} />
              <span className="shrink-0 font-bold text-red-600" aria-label="未解决冲突">U</span>
              <span className="min-w-0 flex-1 truncate" data-title={file.path}>{tree ? file.path.split(/[\\/]/).pop() : file.path}</span>
              <button type="button" aria-label={`在编辑器中修复 ${file.path}`} data-title="在编辑器中修复" className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700" onClick={(event) => { event.stopPropagation(); void g.handleOpenInEditor(file.path) }} onKeyDown={(event) => event.stopPropagation()}><CodeXml className="size-3.5" /></button>
              <button type="button" aria-label={`标记 ${file.path} 为已解决并暂存`} disabled={g.resolvingConflicts} data-title="标记为已解决并暂存" className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-200/80 hover:text-stone-700 disabled:opacity-40 transition-colors" onClick={(event) => { event.stopPropagation(); void g.handleResolveConflicts([file.path]) }} onKeyDown={(event) => event.stopPropagation()}><Plus className="size-3.5" /></button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => void g.handleOpenInEditor(file.path)}><CodeXml />在编辑器中修复</ContextMenuItem>
            <ContextMenuItem disabled={g.resolvingConflicts} onSelect={() => void g.handleResolveConflicts(selected.includes(file.path) ? selected : [file.path])}><Check />标记为已解决并暂存</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>} />
        {!!files.length && !visibleFiles.length && <p className="p-3 text-center text-xs text-stone-400">没有匹配的冲突文件</p>}
      </div>
    </ScrollArea>
  </>
}
