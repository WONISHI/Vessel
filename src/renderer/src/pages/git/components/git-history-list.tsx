import { useEffect } from "react"
import { TextWithArrows } from "@/components/ui/text-with-arrows"
import { HistoryLoadMore } from "@/pages/git/components/history-load-more"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { getGraphWidth, GitGraphSvg } from "@/pages/git/components/git-graph"
import { ArrowDown, ArrowUp, Copy, GitBranch, GitCommit, Globe, CloudCheck, RotateCcw, Tag, Undo2 } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 提交历史工具条与拓扑列表 */
export function GitHistoryList({ g }: { g: GitPageModel }) {
  const { loading, branches, commits, unpushedHashes, commitTotal, branchCommitTotal, historyLoading, historyFailed, selectedCommitIndex, setSelectedCommitIndex, historyFocusNonce, historyScope, setHistoryScope, setCreateBranchOpen, setBranchStartPoint, loadMoreHistory, topology, aheadCount, branchSyncedTotal, behindCount, copyToClipboard, handleCheckoutCommit, handleCreateTag, handleResetBranch, handleUndoLastCommit, handleRevertCommit, handleOpenRemoteCommit } = g
  const graphWidth = getGraphWidth(topology.maxColumns)
  const historyColumns = `${graphWidth}px minmax(0, 1fr) 360px`

  useEffect(() => {
    if (!historyFocusNonce) return
    const row = document.querySelector<HTMLElement>("[data-git-history-selected=\"true\"]")
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [historyFocusNonce, selectedCommitIndex])

  return (
    <>
                  <div className="git-history-toolbar flex shrink-0 items-center justify-between border-b border-stone-200 dark:border-stone-800 bg-stone-50/90 dark:bg-[#20242a] px-3 py-1.5 text-xs text-stone-600 dark:text-stone-300">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">显示分支:</span>
                      <div className="git-scope-pill inline-flex rounded-md border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-[#1c2025] p-0.5">
                        <button
                          type="button"
                          data-scope-active={historyScope === "all"}
                          onClick={() => setHistoryScope("all")}
                          className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                            historyScope === "all"
                              ? "bg-white text-stone-900 shadow-xs dark:bg-[#2d333b] dark:text-stone-100 dark:shadow-none"
                              : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
                          }`}
                        >
                          所有分支
                        </button>
                        <button
                          type="button"
                          data-scope-active={historyScope === "current"}
                          onClick={() => setHistoryScope("current")}
                          className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                            historyScope === "current"
                              ? "bg-white text-stone-900 shadow-xs dark:bg-[#2d333b] dark:text-stone-100 dark:shadow-none"
                              : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
                          }`}
                        >
                          当前分支 {branches.current ? `(${branches.current})` : ""}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                      {branchSyncedTotal > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:text-stone-300"
                          data-title={`远程仓库已同步 ${branchSyncedTotal} 次提交`}
                        >
                          <CloudCheck className="size-3 text-stone-500 dark:text-stone-400" />
                          <span>远程已同步 {branchSyncedTotal} 次</span>
                        </span>
                      )}
                      {aheadCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-500/20 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-400"
                          data-title={`${aheadCount} 次提交未推送到远程仓库`}
                        >
                          <ArrowUp className="size-3 text-orange-600 dark:text-orange-400 stroke-[2.2]" />
                          <span>{aheadCount} 个未推送</span>
                        </span>
                      )}
                      {behindCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400"
                          data-title={`远程仓库有 ${behindCount} 次提交待拉取到本地`}
                        >
                          <ArrowDown className="size-3 text-blue-600 dark:text-blue-400 stroke-[2.2]" />
                          <span>{behindCount} 个待拉取</span>
                        </span>
                      )}
                      <span
                        className="text-stone-400 dark:text-stone-500"
                        data-title={`提交总数: ${branchCommitTotal} 次（远程已同步: ${branchSyncedTotal} 次，未推送到远程: ${aheadCount} 次${behindCount > 0 ? `，待拉取: ${behindCount} 次` : ""}）`}
                      >
                        共 {branchCommitTotal} 次提交
                      </span>
                    </div>
                  </div>

                  <ScrollArea className="min-w-0 flex-1 min-h-0 [&_[data-radix-scroll-area-viewport]>div]:!block">
                    <div className="relative w-full" style={{ minWidth: Math.max(700, graphWidth + 396) }}>
                      {/* 表头 (参考 SourceTree: 图表 | 描述 | 提交 | 作者 | 日期) */}
                      <div style={{ gridTemplateColumns: historyColumns }} className="git-history-table-header sticky top-0 z-20 grid h-7 items-center gap-3 pr-3 text-[11px] font-medium text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 bg-stone-100/95 dark:bg-[#20242a] backdrop-blur-xs select-none">
                        <div
                          style={{ width: graphWidth, minWidth: graphWidth }}
                          className="shrink-0 pl-3.5"
                        >
                          图表
                        </div>
                        <span className="min-w-0">描述</span>
                        <div className="sticky right-0 z-20 grid h-full grid-cols-[80px_112px_144px] items-center gap-3 bg-stone-100 dark:bg-[#20242a]">
                          <span>提交</span>
                          <span>作者</span>
                          <span>日期</span>
                        </div>
                      </div>

                      {/* 提交列表信息容器 */}
                      <div className="relative w-full">
                        {/* SVG 拓扑轨道列 (绝对定位浮层，自然悬浮在每行背景之上) */}
                        <div className="pointer-events-none absolute left-0 top-0 z-10">
                          <GitGraphSvg
                            nodes={topology.nodes}
                            maxColumns={topology.maxColumns}
                            selectedIndex={selectedCommitIndex}
                            onSelectIndex={(idx) => setSelectedCommitIndex(idx)}
                            currentBranch={branches.current}
                          />
                        </div>

                        {commits.map((c, idx) => {
                          const isSelected = idx === selectedCommitIndex
                          return (
                            <ContextMenu key={c.hash}>
                              <ContextMenuTrigger asChild>
                                <div
                                  style={{ height: 32, gridTemplateColumns: historyColumns }}
                                  data-git-history-selected={isSelected}
                                  onClick={() => setSelectedCommitIndex(idx)}
                                  onContextMenu={() => setSelectedCommitIndex(idx)}
                                  className={`group/history-row grid items-center gap-3 pr-3 text-xs cursor-pointer border-b border-stone-100 transition-colors ${isSelected ? "bg-blue-50 text-blue-900 font-medium" : "hover:bg-stone-50 text-stone-700"}`}
                                >
                                  {/* 左侧拓扑图占位 */}
                                  <div
                                    style={{ width: graphWidth, minWidth: graphWidth }}
                                    className="shrink-0"
                                  />
                                  {/* 描述 (含分支标签与提交信息) */}
                                  <span
                                    className="min-w-0 truncate"
                                    data-title={c.message}
                                  >
                                    {c.refs.map((r) => {
                                      const isTag = r.startsWith("tag:")
                                      const isHead = r.startsWith("HEAD -> ") || r === branches.current
                                      const isRemote = r.startsWith("origin/") || r.includes("/")
                                      const badgeClass = isTag
                                        ? "bg-amber-100 text-amber-800 border-amber-200"
                                        : isHead
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold"
                                        : isRemote
                                        ? "bg-purple-100 text-purple-800 border-purple-200"
                                        : "bg-blue-100 text-blue-800 border-blue-200"

                                      return (
                                        <span
                                          key={r}
                                          data-git-sidebar-hover
                                          className={`mr-1.5 rounded border px-1 py-0.5 text-[10px] font-medium ${badgeClass}`}
                                        >
                                          <TextWithArrows text={r} />
                                        </span>
                                      )
                                    })}
                                    {c.message}
                                  </span>
                                  <div className={`sticky right-0 z-10 grid h-full grid-cols-[80px_112px_144px] items-center gap-3 transition-colors ${isSelected ? "bg-blue-50 dark:bg-[#2f343b]" : "bg-white group-hover/history-row:bg-stone-50 dark:bg-[#22272e] dark:group-hover/history-row:bg-[#2d333b]"}`}>
                                    <span className="font-mono text-[11px] text-stone-400">{c.shortHash}</span>
                                    <span className="min-w-0 truncate text-stone-500 text-[11px]" data-title={c.author}>{c.author}</span>
                                    <span className="text-stone-400 text-[11px]">{c.date}</span>
                                  </div>
                                </div>
                              </ContextMenuTrigger>
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
                            </ContextMenu>
                          )
                        })}
                      </div>
                    </div>
                    <HistoryLoadMore loaded={commits.length} total={commitTotal} loading={historyLoading} failed={historyFailed} paused={loading} onLoad={() => void loadMoreHistory()} />
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
    </>
  )
}
