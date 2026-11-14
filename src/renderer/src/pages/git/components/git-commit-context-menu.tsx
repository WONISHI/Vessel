import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "@/components/ui/context-menu"
import { Copy, GitBranch, GitCommit, Globe, RotateCcw, Tag, Undo2 } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
import type { GitCommitItem } from "@vessel/type"

export function GitCommitContextMenu({ g, c, idx }: { g: GitPageModel; c: GitCommitItem; idx: number }) {
  const { branches, unpushedHashes, setBranchStartPoint, setCreateBranchOpen, handleCheckoutCommit, handleCreateTag, handleUndoLastCommit, handleResetBranch, handleRevertCommit, copyToClipboard, handleOpenRemoteCommit } = g
  return (
                              <ContextMenuContent className="w-56">
                                <ContextMenuItem onSelect={() => void handleCheckoutCommit(c.hash)}>
                                  <GitCommit className="size-3.5 text-stone-500" />
                                  <span>检出此提交 ({c.shortHash})</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onSelect={() => {
                                    setBranchStartPoint(c.hash)
                                    setCreateBranchOpen(true)
                                  }}
                                >
                                  <GitBranch className="size-3.5 text-indigo-500" />
                                  <span>在此处创建分支…</span>
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => void handleCreateTag(c.hash)}>
                                  <Tag className="size-3.5 text-stone-500" />
                                  <span>在此处创建标签…</span>
                                </ContextMenuItem>

                                <ContextMenuSeparator />

                                {idx === 0 && (
                                  <>
                                    <ContextMenuSub>
                                      <ContextMenuSubTrigger className="text-amber-700 focus:text-amber-800 font-medium">
                                        <Undo2 className="size-3.5 text-amber-600" />
                                        <span>撤销最后一次提交…</span>
                                      </ContextMenuSubTrigger>
                                      <ContextMenuSubContent className="w-64">
                                        <ContextMenuItem onSelect={() => void handleUndoLastCommit("mixed")}>
                                          <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-stone-800">保留修改在工作区 (推荐)</span>
                                            <span className="text-[10px] text-stone-400">git reset HEAD~1 (退回未暂存区)</span>
                                          </div>
                                        </ContextMenuItem>
                                        <ContextMenuItem onSelect={() => void handleUndoLastCommit("soft")}>
                                          <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-stone-800">保留修改在暂存区</span>
                                            <span className="text-[10px] text-stone-400">git reset --soft HEAD~1</span>
                                          </div>
                                        </ContextMenuItem>
                                      </ContextMenuSubContent>
                                    </ContextMenuSub>
                                    <ContextMenuSeparator />
                                  </>
                                )}

                                <ContextMenuSub>
                                  <ContextMenuSubTrigger className="text-amber-700 focus:text-amber-800">
                                    <RotateCcw className="size-3.5 text-orange-500" />
                                    <span>重置当前分支到此处</span>
                                  </ContextMenuSubTrigger>
                                  <ContextMenuSubContent className="w-64">
                                    <ContextMenuItem onSelect={() => void handleResetBranch(c.hash, "mixed")}>
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-medium text-stone-800">混合重置 (--mixed, 默认)</span>
                                        <span className="text-[10px] text-stone-400">回退到此，修改保留在工作区</span>
                                      </div>
                                    </ContextMenuItem>
                                    <ContextMenuItem onSelect={() => void handleResetBranch(c.hash, "soft")}>
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-medium text-stone-800">软重置 (--soft, 保留暂存)</span>
                                        <span className="text-[10px] text-stone-400">回退到此，修改保留在暂存区</span>
                                      </div>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      className="text-red-600 focus:text-red-600"
                                      onSelect={() => void handleResetBranch(c.hash, "hard")}
                                    >
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-medium text-red-600">强行重置 (--hard, 丢弃修改)</span>
                                        <span className="text-[10px] text-red-400">⚠️ 丢弃所有改动，强制对齐该提交</span>
                                      </div>
                                    </ContextMenuItem>
                                  </ContextMenuSubContent>
                                </ContextMenuSub>

                                <ContextMenuItem onSelect={() => void handleRevertCommit(c.hash)}>
                                  <Undo2 className="size-3.5 text-stone-500" />
                                  <span>回滚此提交 (Revert)</span>
                                </ContextMenuItem>

                                <ContextMenuSeparator />

                                <ContextMenuItem onSelect={() => copyToClipboard(c.hash, "提交 SHA-1")}>
                                  <Copy className="size-3.5 text-stone-500" />
                                  <span>复制提交 SHA-1</span>
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => copyToClipboard(c.message, "提交信息")}>
                                  <Copy className="size-3.5 text-stone-500" />
                                  <span>复制提交信息</span>
                                </ContextMenuItem>
                                {branches.remote.length > 0 && !unpushedHashes.has(c.hash) && (
                                  <ContextMenuItem onSelect={() => void handleOpenRemoteCommit(c.hash)}>
                                    <Globe className="size-3.5 text-stone-500" />
                                    <span>打开远程仓库</span>
                                  </ContextMenuItem>
                                )}
                              </ContextMenuContent>
  )
}
