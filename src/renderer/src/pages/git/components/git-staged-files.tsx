import { gitFilePosition } from "../file-position"
import { useRef } from "react"
import { GitFileLineStats } from "./git-file-line-stats"
import { GitChangesTree } from "./git-changes-tree"
import { GitChangesViewToggle } from "./git-changes-view-toggle"
import { useGitChangesView } from "../hooks/use-git-changes-view"
import { GitChangesSearch } from "./git-changes-search"
import { Button } from "@/components/ui/button"
import { matchesGitFilePath } from "../file-filter"
import { useGitSelectionReveal } from "../hooks/use-git-selection-reveal"
import { gitChangeMarker, gitChangeMarkerClass } from "./file-change-marker"
import { gitChangeStatusTitle } from "@/pages/git/components/file-change-status"
import { GitFileIcon } from "./git-file-icon"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Archive, CheckSquare, Copy, CodeXml, FileText, FolderOpen, ListMinus, Minus, Trash2 } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 已暂存文件列表 */
export function GitStagedFiles({ g }: { g: GitPageModel }) {
  const { status, selectedFile, setSelectedFile, selectedStagedPaths, setSelectedStagedPaths, handleStagedItemClick, handleStagedContextMenu, handleUnstageFile, handleUnstageAll, handleDiscardStaged, handleUnstageMultiple, handleDiscardStagedMultiple, handleStashFiles, getFullPath, copyToClipboard, handleRevealInFinder, handleOpenInEditor } = g

  const pendingStash = useRef<string[] | null>(null)
  const closeMenu = (event: Event) => {
    const paths = pendingStash.current
    pendingStash.current = null
    if (!paths) return
    event.preventDefault()
    // The non-modal dialog must mount after the menu releases its focus scope.
    queueMicrotask(() => handleStashFiles(paths))
  }

  const { tree, toggleTree } = useGitChangesView("staged")
  const query = g.stagedFileQuery ?? ""
  const allFiles = status?.staged ?? []
  const visibleFiles = allFiles.filter(file => matchesGitFilePath(file.path, query))
  const selectedPath = g.activeFileSection === "staged" && selectedFile && selectedStagedPaths.includes(selectedFile.path) ? selectedFile.path : undefined
  const position = gitFilePosition(visibleFiles, selectedPath, tree)

  const selectionRoot = useGitSelectionReveal(g.repoPath, selectedFile?.path, g.activeFileSection === "staged", !!status)

  return (
    <>
                      <div className="flex h-[41px] shrink-0 items-center justify-between border-b border-stone-200 bg-stone-100/70 px-3 py-1.5 text-xs font-semibold text-stone-700">
                        <span className="flex items-center gap-1.5">
                          <span>已暂存文件 (Staged)</span>
                          <span aria-label="已暂存文件位置" className="rounded-full bg-green-100 px-1.5 text-[10px] tabular-nums text-green-700">{position}</span>
                          {selectedStagedPaths.length > 1 && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 font-normal">已选 {selectedStagedPaths.length} 项</span>}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {selectedStagedPaths.length > 1 && (
                            <>
                              <button
                                type="button"
                                className="text-[11px] font-normal text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-0.5"
                                onClick={() => void handleStashFiles(selectedStagedPaths)}
                                data-title="贮藏所选已暂存文件修改"
                              >
                                <Archive className="size-3" />
                                <span>贮藏所选 ({selectedStagedPaths.length})</span>
                              </button>
                              <button
                                type="button"
                                className="text-[11px] font-normal text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-0.5"
                                onClick={() => void handleUnstageMultiple(selectedStagedPaths)}
                                data-title="取消暂存所选文件"
                              >
                                <Minus className="size-3" />
                                <span>取消所选 ({selectedStagedPaths.length})</span>
                              </button>
                            </>
                          )}
                          <GitChangesViewToggle tree={tree} onToggle={toggleTree} label="已暂存文件" />
                          <GitChangesSearch key={g.repoPath} label="已暂存文件" query={query} onChange={g.setStagedFileQuery} />
                          <Button type="button" variant="ghost" size="icon" aria-label="全部取消" data-title="全部取消" data-title-side="bottom" className="git-changes-action size-7 rounded-lg" disabled={g.loading || !allFiles.length} onClick={handleUnstageAll}>
                            <ListMinus className="size-4" strokeWidth={1.75} />
                          </Button>
                        </div>
                      </div>
                      <ScrollArea ref={selectionRoot} className="git-changes-scroll flex-1 min-h-0 min-w-0 p-1">
                        <div className="space-y-0.5">
                          <GitChangesTree key={g.repoPath} files={allFiles} query={query} tree={tree} renderFolderActions={(path, paths) => <button type="button" aria-label={`取消暂存目录 ${path}`} data-title={`取消暂存目录下全部 ${paths.length} 个文件`} disabled={g.loading} className="shrink-0 rounded p-1 text-stone-400 transition-colors hover:bg-stone-200/80 hover:text-amber-700 disabled:opacity-50" onClick={event => { event.stopPropagation(); void handleUnstageMultiple(paths, { clearSelection: true }) }}><Minus className="size-3.5"/></button>} renderFile={(file, idx, tree) => {
                            if (!matchesGitFilePath(file.path, query)) return null
                            const isSelected = selectedStagedPaths.includes(file.path)
                            const isPrimary = selectedFile?.path === file.path
                            const isMulti = selectedStagedPaths.length > 1 && isSelected

                            return (
                              <ContextMenu key={file.path}>
                                <ContextMenuTrigger asChild>
                                  <div
                                    style={tree ? { paddingLeft: "var(--git-tree-padding)" } : undefined}
                                    role="button"
                                    tabIndex={0}
                                    data-git-change-path={file.path}
                                    onKeyDown={(event) => { g.handleStagedItemKeyDown?.(event); if (!event.defaultPrevented && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.currentTarget.click() } }}
                                    data-git-file-selected={isSelected}
                                    data-git-primary-file={isPrimary && isSelected}
                                    onClick={(e) => handleStagedItemClick(e, file, idx)}
                                    onContextMenu={() => handleStagedContextMenu(file, idx)}
                                    className={`group flex w-full min-w-0 items-center justify-between gap-1 rounded px-2 py-1 text-xs cursor-pointer select-none transition-colors ${
                                      isSelected ? (isPrimary ? "bg-stone-200 font-semibold text-stone-900 shadow-xs" : "bg-stone-200/70 text-stone-800") : "hover:bg-stone-100 text-stone-700"
                                    }`}
                                  >
                                    <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden" style={tree ? { gap: "var(--git-tree-column-gap)" } : undefined}>
                                      <GitFileIcon path={file.path} />
                                      {!tree && <span data-git-status-marker className={`w-3.5 shrink-0 text-center font-bold ${gitChangeMarkerClass(file.status)}`} data-title={gitChangeStatusTitle(file.status)} aria-label={gitChangeStatusTitle(file.status)}>{gitChangeMarker(file.status)}</span>}
                                      <span
                                        className="min-w-0 flex-1 truncate"
                                        data-title={file.path}
                                      >
                                        {tree ? file.path.replace(/\\/g, "/").split("/").at(-1) : file.path}
                                      </span>
                                    </span>
                                    <GitFileLineStats file={file} />
                                    <span className={`relative h-[22px] shrink-0 transition-[width] duration-150 ${tree ? "w-[22px] group-hover:w-[44px] group-focus-within:w-[44px]" : "w-0 group-hover:w-[22px] group-focus-within:w-[22px]"}`}>
                                      {tree && <span data-git-status-marker className={`absolute right-1 top-1/2 -translate-y-1/2 w-3.5 text-center font-bold transition-[right] duration-150 group-hover:right-[26px] group-focus-within:right-[26px] ${gitChangeMarkerClass(file.status)}`} data-title={gitChangeStatusTitle(file.status)} aria-label={gitChangeStatusTitle(file.status)}>{gitChangeMarker(file.status)}</span>}
                                      <span className="absolute inset-y-0 right-0 w-[22px] flex justify-end opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                    <button
                                      type="button"
                                      data-title="取消暂存"
                                      className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-200/80 hover:text-amber-700 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        void handleUnstageFile(file.path)
                                      }} aria-label="取消暂存"
                                    >
                                      <Minus className="size-3.5" />
                                    </button>
                                      </span>
                                    </span>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56" onCloseAutoFocus={closeMenu}>
                                  {isMulti ? (
                                    <>
                                      <ContextMenuItem onSelect={() => void handleUnstageMultiple(selectedStagedPaths)}>
                                        <Minus className="size-3.5 text-amber-600" />
                                        <span>取消暂存选中的 {selectedStagedPaths.length} 个文件</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => { pendingStash.current = [...selectedStagedPaths] }}>
                                        <Archive className="size-3.5 text-blue-600" />
                                        <span>贮藏选中的 {selectedStagedPaths.length} 个文件…</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => setSelectedStagedPaths(visibleFiles.map((f) => f.path))}>
                                        <CheckSquare className="size-3.5 text-stone-500" />
                                        <span>全选暂存文件</span>
                                        <span className="ml-auto text-[10px] text-stone-400">⌘A</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => copyToClipboard(selectedStagedPaths.join("\n"), "相对路径")}>
                                        <Copy className="size-3.5 text-stone-500" />
                                        <span>复制选中相对路径 ({selectedStagedPaths.length})</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => copyToClipboard(selectedStagedPaths.map(getFullPath).join("\n"), "绝对路径")}>
                                        <Copy className="size-3.5 text-stone-500" />
                                        <span>复制选中绝对路径 ({selectedStagedPaths.length})</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        className="text-red-600 focus:text-red-600 data-[highlighted]:bg-red-600"
                                        onSelect={() => void handleDiscardStagedMultiple(selectedStagedPaths)}
                                      >
                                        <Trash2 className="size-3.5 text-red-500" />
                                        <span>放弃选中的 {selectedStagedPaths.length} 个文件更改…</span>
                                      </ContextMenuItem>
                                    </>
                                  ) : (
                                    <>
                                      <ContextMenuItem onSelect={() => void handleUnstageFile(file.path)}>
                                        <Minus className="size-3.5 text-amber-600" />
                                        <span>取消暂存文件</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => { pendingStash.current = [...[file.path]] }}>
                                        <Archive className="size-3.5 text-blue-600" />
                                        <span>贮藏此文件修改…</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => void handleUnstageAll()}>
                                        <Minus className="size-3.5 text-stone-500" />
                                        <span>全部取消暂存</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => setSelectedFile(file)}>
                                        <FileText className="size-3.5 text-stone-500" />
                                        <span>查看文件差异</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => void handleOpenInEditor(file.path)}>
                                        <CodeXml className="size-3.5 text-stone-500" />
                                        <span>在编辑器中打开</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => void handleRevealInFinder(file.path)}>
                                        <FolderOpen className="size-3.5 text-stone-500" />
                                        <span>在访达中显示</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => setSelectedStagedPaths(visibleFiles.map((f) => f.path))}>
                                        <CheckSquare className="size-3.5 text-stone-500" />
                                        <span>全选暂存文件</span>
                                        <span className="ml-auto text-[10px] text-stone-400">⌘A</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => copyToClipboard(file.path, "相对路径")}>
                                        <Copy className="size-3.5 text-stone-500" />
                                        <span>复制相对路径</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => copyToClipboard(getFullPath(file.path), "绝对路径")}>
                                        <Copy className="size-3.5 text-stone-500" />
                                        <span>复制绝对路径</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        className="text-red-600 focus:text-red-600 data-[highlighted]:bg-red-600"
                                        onSelect={() => void handleDiscardStaged(file)}
                                      >
                                        <Trash2 className="size-3.5 text-red-500" />
                                        <span>放弃更改…</span>
                                      </ContextMenuItem>
                                    </>
                                  )}
                                </ContextMenuContent>
                              </ContextMenu>
                            )
                          }} />
                          {!!allFiles.length && !visibleFiles.length && <p className="p-3 text-center text-xs text-stone-400">没有匹配的已暂存文件</p>}
                          {!status?.staged.length && <p className="p-3 text-center text-xs text-stone-400">暂无已暂存文件</p>}
                        </div>
                      </ScrollArea>
    </>
  )
}
