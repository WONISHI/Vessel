import { ScrollArea } from "@/components/ui/scroll-area"
import { Archive, ArrowDown, ArrowUp, CheckCircle2, Clock, FileText, GitBranch, CloudCheck, Layers, Plus } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 左侧边栏导航：工作空间 / 分支 / 远程 / 贮藏 */
export function GitSidebarNav({ g }: { g: GitPageModel }) {
  const { activeTab, setActiveTab, status, branches, branchCommitTotal, stashes, setCreateBranchOpen, setBranchStartPoint, aheadCount, branchSyncedTotal, behindCount, handleStashPop, handleStashDrop, handleCheckoutBranch } = g

  return (
            <ScrollArea className="h-full min-h-0 [&_[data-radix-scroll-area-viewport]]:p-2">
              {/* 工作区区段 */}
              <div className="mb-4">
                <div className="px-2 py-1 text-[11px] font-semibold text-stone-400">工作空间</div>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${activeTab === "status" ? "bg-stone-200/80 font-medium text-stone-900" : "text-stone-600 hover:bg-stone-100"}`}
                  data-git-selected={activeTab === "status"}
                  onClick={() => setActiveTab("status")}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="size-3.5 text-stone-500" />
                    文件状态
                  </span>
                  {!!(status?.unstaged.length || status?.staged.length || status?.untracked.length) && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">{(status?.unstaged.length || 0) + (status?.staged.length || 0) + (status?.untracked.length || 0)}</span>}
                </button>

                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${activeTab === "history" ? "bg-stone-200/80 font-medium text-stone-900" : "text-stone-600 hover:bg-stone-100"}`}
                  data-git-selected={activeTab === "history"}
                  onClick={() => setActiveTab("history")}
                >
                  <span className="flex items-center gap-2">
                    <Clock className="size-3.5 text-stone-500" />
                    历史记录
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* 远程仓库已同步的提交数 (带 Globe 图标) */}
                    {branchSyncedTotal > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:text-stone-300"
                        data-title={`远程仓库已同步 ${branchSyncedTotal} 次提交`}
                      >
                        <CloudCheck className="size-2.5 text-stone-500 dark:text-stone-400" />
                        <span>{branchSyncedTotal}</span>
                      </span>
                    )}
                    {/* 未推送到远程仓库的记录 (ahead 待推送) */}
                    {aheadCount > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-400"
                        data-title={`${aheadCount} 次提交未推送到远程仓库`}
                      >
                        <ArrowUp className="size-2.5 stroke-[2.5]" />
                        <span>{aheadCount}</span>
                      </span>
                    )}
                    {/* 远程仓库有新提交待拉取 (behind 待拉取) */}
                    {behindCount > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400"
                        data-title={`远程仓库有 ${behindCount} 次提交待拉取到本地`}
                      >
                        <ArrowDown className="size-2.5 stroke-[2.5]" />
                        <span>{behindCount}</span>
                      </span>
                    )}
                    <span
                      className="text-[10px] text-stone-400 dark:text-stone-500 font-mono"
                      data-title={`提交总数: ${branchCommitTotal} 次（远程已同步: ${branchSyncedTotal} 次，未推送到远程: ${aheadCount} 次${behindCount > 0 ? `，待拉取: ${behindCount} 次` : ""}）`}
                    >
                      {branchCommitTotal}
                    </span>
                  </div>
                </button>
              </div>

              {/* 分支区段 */}
              <div className="mb-4">
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-stone-400">
                  <span>分支 (BRANCHES)</span>
                  <button
                    type="button"
                    data-title="新建分支"
                    className="hover:text-stone-700"
                    onClick={() => {
                      setBranchStartPoint(undefined)
                      setCreateBranchOpen(true)
                    }} aria-label="新建分支"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {branches.local.map((b) => {
                  const isCurrent = b === branches.current
                  return (
                    <div
                      key={b}
                      data-git-selected={isCurrent}
                      data-title={b}
                      onDoubleClick={() => handleCheckoutBranch(b)}
                      onClick={() => handleCheckoutBranch(b)}
                      className={`flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${isCurrent ? "bg-green-50 font-semibold text-green-800" : "text-stone-600 hover:bg-stone-100"}`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                        <GitBranch className={`size-3.5 shrink-0 ${isCurrent ? "text-green-600" : "text-stone-400"}`} />
                        <span className="min-w-0 flex-1 truncate">{b}</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isCurrent && aheadCount > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 px-1 py-0.2 text-[9px] font-bold text-orange-700 dark:text-orange-400"
                            data-title={`${aheadCount} 次提交待推送`}
                          >
                            <ArrowUp className="size-2 stroke-[2.5]" />
                            <span>{aheadCount}</span>
                          </span>
                        )}
                        {isCurrent && behindCount > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 px-1 py-0.2 text-[9px] font-bold text-blue-700 dark:text-blue-400"
                            data-title={`远程有 ${behindCount} 次提交待拉取`}
                          >
                            <ArrowDown className="size-2 stroke-[2.5]" />
                            <span>{behindCount}</span>
                          </span>
                        )}
                        {isCurrent && <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" />}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 远端分支 */}
              {branches.remote.length > 0 && (
                <div className="mb-4">
                  <div className="px-2 py-1 text-[11px] font-semibold text-stone-400">远程 (REMOTES)</div>
                  {branches.remote.map((r) => (
                    <div
                      key={r}
                      data-git-sidebar-hover
                      className="flex items-center gap-2 rounded-md px-2.5 py-1 text-stone-500 hover:bg-stone-100 truncate text-[11px]"
                      data-title={r}
                    >
                      <Layers className="size-3 shrink-0 text-stone-400" />
                      <span className="truncate">{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 贮藏区段 (STASHES) */}
              <div className="mb-4">
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-stone-400">
                  <span className="flex items-center gap-1">
                    <Archive className="size-3" />
                    <span>贮藏 (STASHES)</span>
                  </span>
                  {stashes.length > 0 && <span className="rounded-full bg-stone-200 px-1.5 text-[10px] text-stone-600 font-medium">{stashes.length}</span>}
                </div>
                {stashes.length === 0 ? (
                  <div className="px-2 py-1 text-[11px] text-stone-400 italic">暂无贮藏记录</div>
                ) : (
                  stashes.map((s) => (
                    <div
                      key={s.index}
                      data-git-sidebar-hover
                      className="group flex items-center justify-between rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100 text-[11px]"
                      data-title={`stash@{${s.index}}: ${s.name}`}
                    >
                      <span className="truncate flex-1 mr-1">
                        <span className="font-mono text-stone-400 mr-1">#{s.index}</span>
                        <span className="truncate">{s.name}</span>
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                        <button
                          type="button"
                          className="rounded px-1 py-0.5 text-green-700 hover:bg-green-100 text-[10px] font-medium"
                          data-title="恢复并弹出此贮藏 (git stash pop)"
                          onClick={() => handleStashPop(s.index)}
                        >
                          弹出
                        </button>
                        <button
                          type="button"
                          className="rounded px-1 py-0.5 text-red-600 hover:bg-red-100 text-[10px] font-medium"
                          data-title="丢弃此贮藏 (git stash drop)"
                          onClick={() => handleStashDrop(s.index)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
  )
}
