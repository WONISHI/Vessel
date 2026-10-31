import { FileChangeStatus } from "@/pages/git/components/file-change-status"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, File, FileText, FolderOpen } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 选定提交的详情与变更文件 */
export function GitCommitFiles({ g }: { g: GitPageModel }) {
  const { repoPath, commitDetail, setDiffText, getFullPath, copyToClipboard, handleRevealInFinder } = g

  return (
                      <ScrollArea className="git-commit-files-scroll flex-1 min-h-0 min-w-0 p-3 text-xs">
                        {commitDetail ? (
                          <div>
                            <div className="truncate font-semibold text-stone-800 mb-1" data-title={commitDetail.message}>{commitDetail.message}</div>
                            <div className="truncate text-stone-400 text-[11px] mb-2" data-title={`${commitDetail.author} <${commitDetail.email}> • ${commitDetail.date}`}>
                              {commitDetail.author} &lt;{commitDetail.email}&gt; • {commitDetail.date}
                            </div>
                            <div className="truncate text-[11px] font-mono text-stone-400 mb-3" data-title={`Commit: ${commitDetail.hash}`}>Commit: {commitDetail.hash}</div>

                            <div className="text-[11px] font-semibold text-stone-500 mb-1">变更的文件 ({commitDetail.files.length})</div>
                            <div className="space-y-1">
                              {commitDetail.files.map((f) => (
                                <ContextMenu key={f.path}>
                                  <ContextMenuTrigger asChild>
                                    <div
                                      className="group flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-stone-100 cursor-pointer text-xs"
                                      onClick={() => {
                                        window.electronAPI.git.getDiff(repoPath, f.path, false, commitDetail.hash).then((res) => setDiffText(res.diff))
                                      }}
                                      onContextMenu={() => {
                                        window.electronAPI.git.getDiff(repoPath, f.path, false, commitDetail.hash).then((res) => setDiffText(res.diff))
                                      }}
                                    >
                                      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                        {/* 2号: 文件图标 */}
                                        <File className={`size-3.5 shrink-0 ${getFilePresentation(f.path).color}`} />
                                        {/* 3号: 溢出显示省略号 */}
                                        <span
                                          className="truncate min-w-0 flex-1 text-stone-700"
                                          data-title={f.path}
                                        >
                                          {f.path}
                                        </span>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-2">
                                        {f.additions > 0 && <span className="text-[10px] font-mono text-green-600">+{f.additions}</span>}
                                        {f.deletions > 0 && <span className="text-[10px] font-mono text-red-600">−{f.deletions}</span>}
                                        <FileChangeStatus status={f.status} />
                                      </div>
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-52">
                                    <ContextMenuItem
                                      onSelect={() => {
                                        window.electronAPI.git.getDiff(repoPath, f.path, false, commitDetail.hash).then((res) => setDiffText(res.diff))
                                      }}
                                    >
                                      <FileText className="size-3.5 text-stone-500" />
                                      <span>查看文件差异</span>
                                    </ContextMenuItem>
                                    <ContextMenuItem onSelect={() => void handleRevealInFinder(f.path)}>
                                      <FolderOpen className="size-3.5 text-stone-500" />
                                      <span>在访达中显示</span>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem onSelect={() => copyToClipboard(f.path, "相对路径")}>
                                      <Copy className="size-3.5 text-stone-500" />
                                      <span>复制相对路径</span>
                                    </ContextMenuItem>
                                    <ContextMenuItem onSelect={() => copyToClipboard(getFullPath(f.path), "绝对路径")}>
                                      <Copy className="size-3.5 text-stone-500" />
                                      <span>复制绝对路径</span>
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-stone-400">选择一次提交查看详细内容</p>
                        )}
                      </ScrollArea>
  )
}
