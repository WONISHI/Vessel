import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { HistoryLoadMore } from "@/pages/git/components/history-load-more"
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import { GitCommitContextMenu } from "./git-commit-context-menu"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { GitLog } from "@tomplum/react-git-log"
import { syncGitRefLayout } from "./git-ref-layout"
import { toGitLogEntries } from "./git-log-entries"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import "./git-log.css"
import { ArrowDown, ArrowUp, CloudCheck } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 提交历史工具条与拓扑列表 */
export function GitHistoryList({ g }: { g: GitPageModel }) {
  const { loading, branches, commits, commitTotal, branchCommitTotal, historyLoading, historyFailed, selectedCommitIndex, setSelectedCommitIndex, historyFocusNonce, historyScope, setHistoryScope, loadMoreHistory, aheadCount, branchSyncedTotal, behindCount, status } = g
  const dark = useDarkAppearance()
  const logRoot = useRef<HTMLDivElement>(null)
  const selectedHash = useRef<string | undefined>(undefined)
  const [contextHash, setContextHash] = useState<string>()
  const entries = useMemo(() => toGitLogEntries(commits, branches.current), [commits, branches.current])
  const indices = useMemo(() => new Map(commits.map((commit, index) => [commit.hash, index])), [commits])
  const contextIndex = contextHash ? indices.get(contextHash) : undefined
  const indexStatus = useMemo(() => {
    const files = new Map([...(status?.unstaged ?? []), ...(status?.untracked ?? []), ...(status?.staged ?? []), ...(status?.conflicts ?? [])].map((file) => [file.path, file]))
    return {
      added: [...files.values()].filter((file) => file.status === "A" || file.status === "?").length,
      deleted: [...files.values()].filter((file) => file.status === "D").length,
      modified: [...files.values()].filter((file) => file.status !== "A" && file.status !== "?" && file.status !== "D").length
    }
  }, [status])

  // The library has no header-label API. Localise only its native headings.
  useLayoutEffect(() => {
    const labels: Record<string, string> = {
      "Branch / Tag": "分支 / 标签",
      Graph: "提交图",
      "Commit message": "提交信息",
      Author: "作者",
      Timestamp: "提交时间"
    }
    logRoot.current?.querySelectorAll("h4, [id^='react-git-log-table-header-']").forEach((heading) => {
      const label = labels[heading.textContent ?? ""]
      if (label) heading.textContent = label
    })
  })

  // Upstream accepts only one `branch` per commit. Keep the real HEAD branch
  // for graph layout, and add its tags to the native ref row instead of
  // changing branch identity (which would also change graph colours/lanes).
  useLayoutEffect(() => {
    const badges: HTMLElement[] = []
    commits.forEach((commit, index) => {
      if (!commit.refs.some(ref => ref === "HEAD" || ref.startsWith("HEAD -> "))) return
      const label = logRoot.current?.querySelector<HTMLElement>(`[id="tag-label-${index + 1}"]`)
      if (!label) return
      for (const ref of commit.refs.filter(ref => ref.startsWith("tag:"))) {
        const name = ref.replace(/^tag:\s*/, "")
        const badge = label.cloneNode(false) as HTMLElement
        badge.removeAttribute("id")
        badge.removeAttribute("data-testid")
        badge.dataset.vesselHeadTag = name
        badge.title = `标签：${name}`
        badge.textContent = name
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        icon.setAttribute("viewBox", "0 0 24 24")
        icon.setAttribute("width", "16")
        icon.setAttribute("height", "16")
        icon.setAttribute("fill", "none")
        icon.setAttribute("stroke", "currentColor")
        icon.setAttribute("stroke-width", "2")
        icon.setAttribute("aria-hidden", "true")
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
        path.setAttribute("d", "M20 13 13 20a2 2 0 0 1-3 0L2 12V2h10l8 8a2 2 0 0 1 0 3ZM7 7h.01")
        icon.append(path)
        badge.append(icon)
        label.before(badge)
        badges.push(badge)
      }
    })
    return () => badges.forEach(badge => badge.remove())
  })

  useLayoutEffect(() => {
    const root = logRoot.current
    if (!root) return
    let frame = 0
    const sync = () => syncGitRefLayout(root, ["index", ...commits.map(commit => commit.hash)])
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync) }
    sync()
    const resize = new ResizeObserver(schedule)
    resize.observe(root)
    const log = root.querySelector("#react-git-log")
    for (const column of Array.from(log?.children ?? []).slice(0, 2)) resize.observe(column)
    // The graph can add virtual lanes without resizing its outer column.
    const changes = new MutationObserver(schedule)
    if (log?.children[1]) changes.observe(log.children[1], { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] })
    if (log?.children[0]) changes.observe(log.children[0], { childList: true, subtree: true, characterData: true })
    window.addEventListener("resize", schedule)
    window.visualViewport?.addEventListener("resize", schedule)
    document.fonts?.addEventListener("loadingdone", schedule)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      changes.disconnect()
      window.removeEventListener("resize", schedule)
      window.visualViewport?.removeEventListener("resize", schedule)
      document.fonts?.removeEventListener("loadingdone", schedule)
    }
  })

  useEffect(() => {
    const hash = commits[selectedCommitIndex]?.hash
    if (!hash) return
    const node = logRoot.current?.querySelector<HTMLElement>(`[id="commit-node-${hash}"]`)
    // The library has no controlled selection prop. Drive its public node click
    // so sidebar navigation highlights the same native row and graph node.
    if (node && selectedHash.current !== hash) {
      selectedHash.current = hash
      node.click()
    }
    if (historyFocusNonce) node?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [commits, selectedCommitIndex, historyFocusNonce])

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
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div ref={logRoot} className="git-log-demo" onContextMenuCapture={(event) => {
                          const target = event.target as HTMLElement
                          const row = target.closest('[id^="react-git-log-table-row-"]')
                          const graphCell = target.closest('[id^="graph-column-row-"]')
                          const rowNumber = row?.id.match(/row-(\d+)$/)?.[1] ?? graphCell?.id.match(/row-(\d+)-/)?.[1]
                          const node = rowNumber === undefined ? null : logRoot.current?.querySelector<HTMLElement>(`[id^="graph-column-row-${rowNumber}-col-"] [id^="commit-node-"][role="button"]`)
                          const hash = node?.id.slice("commit-node-".length)
                          const index = hash ? indices.get(hash) : undefined
                          if (index === undefined) { event.preventDefault(); return }
                          setContextHash(hash)
                          setSelectedCommitIndex(index)
                        }}>
                          {commits.length > 0 && <GitLog
                            entries={entries}
                            currentBranch={branches.current || "HEAD"}
                            theme={dark ? "dark" : "light"}
                            colours={dark ? "rainbow-dark" : "rainbow-light"}
                            showHeaders
                            showGitIndex
                            indexStatus={indexStatus}
                            defaultGraphWidth={120}
                            rowSpacing={0}
                            onSelectCommit={(commit) => {
                              selectedHash.current = commit?.hash
                              if (commit?.hash === "index") { g.setActiveTab("status"); return }
                              const index = commit && indices.get(commit.hash)
                              if (index !== undefined) setSelectedCommitIndex(index)
                            }}
                          >
                            <GitLog.Tags />
                            <GitLog.GraphHTMLGrid nodeSize={14} nodeTheme="default" breakPointTheme="dot" />
                            <GitLog.Table />
                          </GitLog>}
                        </div>
                      </ContextMenuTrigger>
                      {contextIndex !== undefined && <GitCommitContextMenu g={g} c={commits[contextIndex]} idx={contextIndex} />}
                    </ContextMenu>
                    <HistoryLoadMore loaded={commits.length} total={commitTotal} loading={historyLoading} failed={historyFailed} paused={loading} onLoad={() => void loadMoreHistory()} />
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
    </>
  )
}
