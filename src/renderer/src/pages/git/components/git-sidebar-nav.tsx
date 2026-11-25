import { useMemo, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Archive, ArchiveRestore, Copy, ArrowDown, ArrowUp, CloudCheck, Clock, FileText, Plus, Search, Trash2 } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
import { GitBranchTree } from "@/pages/git/components/git-branch-tree"

/** 左侧边栏导航：工作空间 / 分支 / 远程 / 贮藏 */
export function GitSidebarNav({ g }: { g: GitPageModel }) {
  const {
    activeTab,
    setActiveTab,
    status,
    branches,
    branchCommitTotal,
    stashes,
    setCreateBranchOpen,
    setBranchStartPoint,
    setBranchNamePrefix,
    aheadCount,
    branchSyncedTotal,
    behindCount,
    handleStashPop,
    handleStashDrop,
    handleCheckoutBranch,
    handleDeleteBranch,
    handleMergeBranch,
    handleFetch,
    handlePull,
    handlePush,
    navigateToBranchTip,
    copyToClipboard
  } = g
  const [pendingCheckout, setPendingCheckout] = useState<string | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [pendingMerge, setPendingMerge] = useState<string | null>(null)
  const [mergeBusy, setMergeBusy] = useState(false)

  const remoteAutoExpand = useMemo(() => {
    if (!branches.current) return undefined
    return branches.remote.find((remote) => remote === branches.current || remote.endsWith(`/${branches.current}`))
  }, [branches.current, branches.remote])

  /** Opens checkout confirm for a leaf branch. */
  const requestCheckout = (branch: string) => {
    if (!branch || branch === branches.current) return
    setPendingCheckout(branch)
  }

  /** Confirms checkout after secondary dialog. */
  const confirmCheckout = () => {
    const branch = pendingCheckout
    if (!branch || checkoutBusy) return
    setCheckoutBusy(true)
    void handleCheckoutBranch(branch)
      .catch(() => {})
      .finally(() => {
        setCheckoutBusy(false)
        setPendingCheckout(null)
      })
  }

  /** Opens delete confirm for a local branch. */
  const requestDelete = (branch: string) => {
    if (!branch || branch === branches.current) return
    setPendingDelete(branch)
  }

  /** Confirms local branch delete. */
  const confirmDelete = () => {
    const branch = pendingDelete
    if (!branch || deleteBusy) return
    setDeleteBusy(true)
    void handleDeleteBranch(branch)
      .catch(() => {})
      .finally(() => {
        setDeleteBusy(false)
        setPendingDelete(null)
      })
  }

  /** Opens merge confirm. */
  const requestMerge = (branch: string) => {
    if (!branch || branch === branches.current) return
    setPendingMerge(branch)
  }

  /** Confirms merge into current. */
  const confirmMerge = () => {
    const branch = pendingMerge
    if (!branch || mergeBusy) return
    setMergeBusy(true)
    void handleMergeBranch(branch)
      .catch(() => {})
      .finally(() => {
        setMergeBusy(false)
        setPendingMerge(null)
      })
  }

  const treeActions = {
    onSelectBranch: navigateToBranchTip,
    onRequestCheckout: requestCheckout,
    onCreateBranchFrom: (startPoint: string, namePrefix?: string) => {
      setBranchStartPoint(startPoint || undefined)
      setBranchNamePrefix(namePrefix || "")
      setCreateBranchOpen(true)
    },
    onMergeIntoCurrent: requestMerge,
    onDeleteBranch: requestDelete,
    onCopyName: (name: string) => copyToClipboard(name, "分支名"),
    onFetchRemote: (remote: string) => void handleFetch(remote),
    onPullRemoteBranch: (remote: string, branch: string) => handlePull(remote, branch || undefined),
    onPushToRemote: (remote: string) => void handlePush(remote)
  }

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
                  <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                    <FileText className="size-3.5 text-stone-500" />
                    文件状态
                  </span>
                  {!!(status?.conflicts.length || status?.unstaged.length || status?.staged.length || status?.untracked.length) && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">{(status?.unstaged.length || 0) + (status?.staged.length || 0) + (status?.untracked.length || 0) + (status?.conflicts.length || 0)}</span>}
                </button>

                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${activeTab === "history" ? "bg-stone-200/80 font-medium text-stone-900" : "text-stone-600 hover:bg-stone-100"}`}
                  data-git-selected={activeTab === "history"}
                  onClick={() => setActiveTab("history")}
                >
                  <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                    <Clock className="size-3.5 text-stone-500" />
                    历史记录
                  </span>
                  <div className="git-history-nav-summary flex shrink-0 items-center gap-1 whitespace-nowrap">
                    {branchSyncedTotal > 0 && (
                      <span
                        className="git-history-synced-count inline-flex items-center gap-0.5 rounded-full bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:text-stone-300"
                        data-title={`远程仓库已同步 ${branchSyncedTotal} 次提交`}
                      >
                        <CloudCheck className="size-2.5 text-stone-500 dark:text-stone-400" />
                        <span>{branchSyncedTotal}</span>
                      </span>
                    )}
                    {aheadCount > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-400"
                        data-title={`${aheadCount} 次提交未推送到远程仓库`}
                      >
                        <ArrowUp className="size-2.5 stroke-[2.5]" />
                        <span>{aheadCount}</span>
                      </span>
                    )}
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
                <button type="button" onClick={() => setActiveTab("search")} data-git-selected={activeTab === "search"}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors ${activeTab === "search" ? "bg-stone-200/80 font-medium text-stone-900" : "text-stone-600 hover:bg-stone-100"}`}>
                  <Search className="size-3.5 text-stone-500" />搜索
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
                <GitBranchTree
                  names={branches.local}
                  currentBranch={branches.current}
                  autoExpandBranch={branches.current}
                  variant="local"
                  aheadCount={aheadCount}
                  behindCount={behindCount}
                  {...treeActions}
                />
              </div>

              {/* 远端分支 */}
              {branches.remote.length > 0 && (
                <div className="mb-4">
                  <div className="px-2 py-1 text-[11px] font-semibold text-stone-400">远程 (REMOTES)</div>
                  <GitBranchTree
                    names={branches.remote}
                    currentBranch={branches.current}
                    autoExpandBranch={remoteAutoExpand}
                    variant="remote"
                    {...treeActions}
                  />
                </div>
              )}

              {/* 贮藏区段 (STASHES) */}
              <div className="mb-4">
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-stone-400">
                  <span className="flex items-center gap-1">
                    <Archive className="size-3" />
                    <span>贮藏 (STASHES)</span>
                    <span className="text-[10px] font-normal">最新在上</span>
                  </span>
                  {stashes.length > 0 && <span className="rounded-full bg-stone-200 px-1.5 text-[10px] text-stone-600 font-medium">{stashes.length}</span>}
                </div>
                {stashes.length === 0 ? (
                  <div className="px-2 py-1 text-[11px] text-stone-400 italic">暂无贮藏记录</div>
                ) : (
                  // Git's stash@{0} is newest. Sort a copy and keep each original selector.
                  [...stashes].sort((a, b) => a.index - b.index).map((s) => (
                    <div
                      key={s.hash || s.index}
                      data-git-stash-row
                      role="button"
                      tabIndex={0}
                      data-git-selected={activeTab === "stash" && (g.selectedStash?.hash && s.hash ? g.selectedStash.hash === s.hash : g.selectedStash?.index === s.index)}
                      onClick={() => void g.viewStash(s)}
                      onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); void g.viewStash(s) } }}
                      data-git-sidebar-hover
                      className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100 text-[11px] ${activeTab === "stash" && g.selectedStash?.hash === s.hash && s.hash ? "bg-stone-200" : ""}`}
                      data-title={`stash@{${s.index}}: ${s.name}`}
                    >
                      <span className="truncate flex-1 mr-1">
                        <span className="font-mono text-stone-400 mr-1">#{s.index}</span>
                        <span className="truncate">{s.name}</span>
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 shrink-0">
                        <button
                          type="button"
                          aria-label="弹出贮藏"
                          disabled={g.restoringStash}
                          className="grid size-5 place-items-center rounded text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-500/15"
                          data-title="合并恢复；成功后删除记录，冲突时保留；本地修改重叠时停止"
                          onClick={(event) => { event.stopPropagation(); void handleStashPop(s.index) }}
                        >
                          <ArchiveRestore className="size-3.5" />
                        </button>
                        <button type="button" aria-label="应用贮藏并保留" disabled={g.restoringStash} className="grid size-5 place-items-center rounded text-blue-600 hover:bg-blue-100 dark:text-blue-400" data-title="应用并保留此贮藏（git stash apply，冲突时也保留）" onClick={(event) => { event.stopPropagation(); void g.handleStashApply(s.index) }}><Copy className="size-3.5" /></button>
                        <button
                          type="button"
                          aria-label="删除贮藏"
                          disabled={g.restoringStash}
                          className="grid size-5 place-items-center rounded text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/15"
                          data-title="丢弃此贮藏 (git stash drop)"
                          onClick={(event) => { event.stopPropagation(); void handleStashDrop(s.index) }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <ConfirmDialog
                open={pendingCheckout !== null}
                onOpenChange={(open) => {
                  if (!open && !checkoutBusy) setPendingCheckout(null)
                }}
                title="切换分支"
                description={pendingCheckout ? <>确定切换到分支 <strong>{pendingCheckout}</strong> 吗？</> : null}
                confirmText={checkoutBusy ? "切换中…" : "切换"}
                busy={checkoutBusy}
                tone="primary"
                onConfirm={confirmCheckout}
              />

              <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                  if (!open && !deleteBusy) setPendingDelete(null)
                }}
                title="删除分支"
                description={pendingDelete ? <>确定删除本地分支 <strong>{pendingDelete}</strong> 吗？未合并的提交可能丢失。</> : null}
                confirmText={deleteBusy ? "删除中…" : "删除"}
                busy={deleteBusy}
                tone="danger"
                onConfirm={confirmDelete}
              />

              <ConfirmDialog
                open={pendingMerge !== null}
                onOpenChange={(open) => {
                  if (!open && !mergeBusy) setPendingMerge(null)
                }}
                title="合并分支"
                description={pendingMerge ? <>确定将 <strong>{pendingMerge}</strong> 合并到当前分支 <strong>{branches.current || "HEAD"}</strong> 吗？</> : null}
                confirmText={mergeBusy ? "合并中…" : "合并"}
                busy={mergeBusy}
                tone="primary"
                onConfirm={confirmMerge}
              />


            </ScrollArea>
  )
}
