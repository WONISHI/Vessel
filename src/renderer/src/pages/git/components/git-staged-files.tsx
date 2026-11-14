import { gitChangeMarker, gitChangeMarkerClass } from "./file-change-marker"
import { gitChangeStatusTitle } from "@/pages/git/components/file-change-status"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Archive, CheckSquare, Copy, File, FileText, FolderOpen, Minus, Trash2 } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 已暂存文件列表 */
export function GitStagedFiles({ g }: { g: GitPageModel }) {
  const { status, selectedFile, setSelectedFile, selectedStagedPaths, setSelectedStagedPaths, handleStagedItemClick, handleStagedContextMenu, handleUnstageFile, handleUnstageAll, handleDiscardStaged, handleUnstageMultiple, handleDiscardStagedMultiple, handleStashFiles, getFullPath, copyToClipboard, handleRevealInFinder } = g

  return (
    <>
                      <div className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-stone-100/70 px-3 py-1.5 text-xs font-semibold text-stone-700">
                        <span className="flex items-center gap-1.5">
                          <span>已暂存文件 (Staged)</span>
                          <span className="rounded-full bg-green-100 px-1.5 text-[10px] text-green-700">{status?.staged.length || 0}</span>
                          {selectedStagedPaths.length > 1 && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 font-normal">已选 {selectedStagedPaths.length} 项</span>}
                        </span>
                        <div className="flex items-center gap-2">
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
                          <button
                            type="button"
                            className="text-[11px] font-normal text-stone-500 hover:text-stone-800"
                            onClick={handleUnstageAll}
                          >
                            全部取消
                          </button>
                        </div>
                      </div>
                      <ScrollArea className="git-changes-scroll flex-1 min-h-0 min-w-0 p-1">
                        <div className="space-y-0.5">
                          {status?.staged.map((file, idx) => {
                            const isSelected = selectedStagedPaths.includes(file.path)
                            const isPrimary = selectedFile?.path === file.path
                            const isMulti = selectedStagedPaths.length > 1 && isSelected

                            return (
                              <ContextMenu key={file.path}>
                                <ContextMenuTrigger asChild>
                                  <div
                                    data-git-file-selected={isSelected}
                                    onClick={(e) => handleStagedItemClick(e, file, idx)}
                                    onContextMenu={() => handleStagedContextMenu(file, idx)}
                                    className={`group flex w-full min-w-0 items-center justify-between gap-1 rounded px-2 py-1 text-xs cursor-pointer select-none transition-colors ${
                                      isSelected ? (isPrimary ? "bg-stone-200 font-semibold text-stone-900 shadow-xs" : "bg-stone-200/70 text-stone-800") : "hover:bg-stone-100 text-stone-700"
                                    }`}
                                  >
                                    <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                      <File className={`size-3.5 shrink-0 ${getFilePresentation(file.path).color}`} />
                                      <span className={`w-3.5 shrink-0 text-center font-bold ${gitChangeMarkerClass(file.status)}`} data-title={gitChangeStatusTitle(file.status)} aria-label={gitChangeStatusTitle(file.status)}>{gitChangeMarker(file.status)}</span>
                                      <span
                                        className="truncate"
                                        data-title={file.path}
                                      >
                                        {file.path}
                                      </span>
                                    </span>
                                    <button
                                      type="button"
                                      data-title="取消暂存"
                                      className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-1 text-stone-400 hover:bg-stone-200/80 hover:text-amber-700 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        void handleUnstageFile(file.path)
                                      }} aria-label="取消暂存"
                                    >
                                      <Minus className="size-3.5" />
                                    </button>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56">
                                  {isMulti ? (
                                    <>
                                      <ContextMenuItem onSelect={() => void handleUnstageMultiple(selectedStagedPaths)}>
                                        <Minus className="size-3.5 text-amber-600" />
                                        <span>取消暂存选中的 {selectedStagedPaths.length} 个文件</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => void handleStashFiles(selectedStagedPaths)}>
                                        <Archive className="size-3.5 text-blue-600" />
                                        <span>贮藏选中的 {selectedStagedPaths.length} 个文件…</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => setSelectedStagedPaths(status?.staged.map((f) => f.path) || [])}>
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
                                      <ContextMenuItem onSelect={() => void handleStashFiles([file.path])}>
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
                                      <ContextMenuItem onSelect={() => void handleRevealInFinder(file.path)}>
                                        <FolderOpen className="size-3.5 text-stone-500" />
                                        <span>在访达中显示</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => setSelectedStagedPaths(status?.staged.map((f) => f.path) || [])}>
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
                          })}
                          {!status?.staged.length && <p className="p-3 text-center text-xs text-stone-400">暂无已暂存文件</p>}
                        </div>
                      </ScrollArea>
    </>
  )
}
