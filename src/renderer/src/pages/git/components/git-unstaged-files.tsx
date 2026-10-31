import { gitChangeStatusTitle } from "@/pages/git/components/file-change-status"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Archive, CheckSquare, Copy, File, FileText, FolderOpen, Plus, Trash2 } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 未暂存更改列表 */
export function GitUnstagedFiles({ g }: { g: GitPageModel }) {
  const { status, selectedFile, setSelectedFile, selectedUnstagedPaths, setSelectedUnstagedPaths, handleUnstagedItemClick, handleUnstagedContextMenu, handleStageFile, handleStageAll, handleDiscard, handleStageMultiple, handleDiscardMultiple, handleStashFiles, getFullPath, copyToClipboard, handleRevealInFinder } = g

  return (
    <>
                      <div className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-stone-100/70 px-3 py-1.5 text-xs font-semibold text-stone-700">
                        <span className="flex items-center gap-1.5">
                          <span>未暂存更改 (Unstaged)</span>
                          <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-700">{(status?.unstaged.length || 0) + (status?.untracked.length || 0)}</span>
                          {selectedUnstagedPaths.length > 1 && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 font-normal">已选 {selectedUnstagedPaths.length} 项</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          {selectedUnstagedPaths.length > 1 && (
                            <>
                              <button
                                type="button"
                                className="text-[11px] font-normal text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-0.5"
                                onClick={() => void handleStashFiles(selectedUnstagedPaths)}
                                data-title="贮藏所选未暂存修改"
                              >
                                <Archive className="size-3" />
                                <span>贮藏所选 ({selectedUnstagedPaths.length})</span>
                              </button>
                              <button
                                type="button"
                                className="text-[11px] font-normal text-green-700 hover:text-green-900 hover:underline flex items-center gap-0.5"
                                onClick={() => void handleStageMultiple(selectedUnstagedPaths)}
                                data-title="暂存所选文件"
                              >
                                <Plus className="size-3" />
                                <span>暂存所选 ({selectedUnstagedPaths.length})</span>
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="text-[11px] font-normal text-stone-500 hover:text-stone-800"
                            onClick={handleStageAll}
                          >
                            全部暂存
                          </button>
                        </div>
                      </div>
                      <ScrollArea className="git-changes-scroll flex-1 min-h-0 min-w-0 p-1">
                        <div className="space-y-0.5">
                          {[...(status?.unstaged || []), ...(status?.untracked || [])].map((file, idx) => {
                            const allUnstaged = [...(status?.unstaged || []), ...(status?.untracked || [])]
                            const isSelected = selectedUnstagedPaths.includes(file.path)
                            const isPrimary = selectedFile?.path === file.path
                            const isMulti = selectedUnstagedPaths.length > 1 && isSelected

                            return (
                              <ContextMenu key={file.path}>
                                <ContextMenuTrigger asChild>
                                  <div
                                    data-git-file-selected={isSelected}
                                    onClick={(e) => handleUnstagedItemClick(e, file, idx)}
                                    onContextMenu={() => handleUnstagedContextMenu(file, idx)}
                                    className={`group flex w-full min-w-0 items-center justify-between gap-1 rounded px-2 py-1 text-xs cursor-pointer select-none transition-colors ${
                                      isSelected ? (isPrimary ? "bg-stone-200 font-semibold text-stone-900 shadow-xs" : "bg-stone-200/70 text-stone-800") : "hover:bg-stone-100 text-stone-700"
                                    }`}
                                  >
                                    <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                      <File className={`size-3.5 shrink-0 ${getFilePresentation(file.path).color}`} />
                                      <span data-title={gitChangeStatusTitle(file.status)} aria-label={gitChangeStatusTitle(file.status)} className={`w-3.5 shrink-0 text-center font-bold ${file.status === "?" ? "text-blue-500" : "text-amber-600"}`}>{file.status}</span>
                                      <span
                                        className="truncate"
                                        data-title={file.path}
                                      >
                                        {file.path}
                                      </span>
                                    </span>
                                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                      <button
                                        type="button"
                                        data-title="暂存此文件"
                                        className="rounded p-1 text-stone-400 hover:bg-stone-200/80 hover:text-green-700 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          void handleStageFile(file.path)
                                        }} aria-label="暂存此文件"
                                      >
                                        <Plus className="size-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        data-title="放弃修改"
                                        className="rounded p-1 text-stone-400 hover:bg-stone-200/80 hover:text-red-600 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          void handleDiscard(file)
                                        }} aria-label="放弃修改"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56">
                                  {isMulti ? (
                                    <>
                                      <ContextMenuItem onSelect={() => void handleStageMultiple(selectedUnstagedPaths)}>
                                        <Plus className="size-3.5 text-green-600" />
                                        <span>暂存选中的 {selectedUnstagedPaths.length} 个文件</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => void handleStashFiles(selectedUnstagedPaths)}>
                                        <Archive className="size-3.5 text-blue-600" />
                                        <span>贮藏选中的 {selectedUnstagedPaths.length} 个文件…</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => setSelectedUnstagedPaths(allUnstaged.map((f) => f.path))}>
                                        <CheckSquare className="size-3.5 text-stone-500" />
                                        <span>全选未暂存更改</span>
                                        <span className="ml-auto text-[10px] text-stone-400">⌘A</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => copyToClipboard(selectedUnstagedPaths.join("\n"), "相对路径")}>
                                        <Copy className="size-3.5 text-stone-500" />
                                        <span>复制选中相对路径 ({selectedUnstagedPaths.length})</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => copyToClipboard(selectedUnstagedPaths.map(getFullPath).join("\n"), "绝对路径")}>
                                        <Copy className="size-3.5 text-stone-500" />
                                        <span>复制选中绝对路径 ({selectedUnstagedPaths.length})</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        className="text-red-600 focus:text-red-600 data-[highlighted]:bg-red-600"
                                        onSelect={() => void handleDiscardMultiple(selectedUnstagedPaths)}
                                      >
                                        <Trash2 className="size-3.5 text-red-500" />
                                        <span>放弃选中的 {selectedUnstagedPaths.length} 个文件修改…</span>
                                      </ContextMenuItem>
                                    </>
                                  ) : (
                                    <>
                                      <ContextMenuItem onSelect={() => void handleStageFile(file.path)}>
                                        <Plus className="size-3.5 text-green-600" />
                                        <span>暂存此文件</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => void handleStashFiles([file.path])}>
                                        <Archive className="size-3.5 text-blue-600" />
                                        <span>贮藏此文件修改…</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => void handleStageAll()}>
                                        <Plus className="size-3.5 text-stone-500" />
                                        <span>全部暂存</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => setSelectedFile(file)}>
                                        <FileText className="size-3.5 text-stone-500" />
                                        <span>查看文件差异</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => void handleRevealInFinder(file.path)}>
                                        <FolderOpen className="size-3.5 text-stone-500" />
                                        <span>在访达中显示</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => setSelectedUnstagedPaths(allUnstaged.map((f) => f.path))}>
                                        <CheckSquare className="size-3.5 text-stone-500" />
                                        <span>全选未暂存更改</span>
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
                                        onSelect={() => void handleDiscard(file)}
                                      >
                                        <Trash2 className="size-3.5 text-red-500" />
                                        <span>放弃修改…</span>
                                      </ContextMenuItem>
                                    </>
                                  )}
                                </ContextMenuContent>
                              </ContextMenu>
                            )
                          })}
                          {!status?.unstaged.length && !status?.untracked.length && <p className="p-3 text-center text-xs text-stone-400">工作区干净，无任何变更</p>}
                        </div>
                      </ScrollArea>
    </>
  )
}
