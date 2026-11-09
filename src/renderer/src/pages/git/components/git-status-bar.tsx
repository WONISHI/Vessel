import { StatusBar } from "@/components/ui/status-bar"
import type { GitCommitItem } from "@vessel/type"
import { ArrowDown, ArrowUp, Clock, GitBranch, GitCommitHorizontal, User } from "lucide-react"
import { useEffect, useState } from "react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** Formats a commit time relative to now, falling back to the absolute date after a week. */
function relativeTime(timestamp: number, fallback: string) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return "刚刚"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} 天前`
  return fallback
}

/** Git page footer on the shared status bar: branch, committer identity and the branch's latest commit. */
export function GitStatusBar({ g }: { g: GitPageModel }) {
  const { repoPath, isRepo, branches, status, aheadCount, behindCount, navigateToBranchTip, setRepositorySettingsOpen } = g
  const [head, setHead] = useState<GitCommitItem | null>(null)
  const [identity, setIdentity] = useState<{ name: string; email: string } | null>(null)

  useEffect(() => {
    if (!repoPath || !isRepo) return
    let active = true
    void Promise.all([
      window.electronAPI.git.getLog(repoPath, 1, 0, false).catch(() => []),
      window.electronAPI.git.getRepositorySettings(repoPath).catch(() => null)
    ]).then(([log, settings]) => {
      if (!active) return
      setHead(log[0] ?? null)
      setIdentity(settings ? { name: settings.userName, email: settings.userEmail } : null)
    })
    return () => { active = false }
  }, [repoPath, isRepo, branches.current, status])

  const ready = !!repoPath && isRepo
  return (
    <StatusBar
      left={ready && <>
        <button type="button" data-title={`当前分支：${branches.current || "HEAD（游离）"}，点击定位到分支最新提交`} onClick={() => navigateToBranchTip(branches.current)} disabled={!branches.current}>
          <GitBranch />
          <span className="max-w-48 truncate">{branches.current || "HEAD（游离）"}</span>
          {aheadCount > 0 && <span className="flex items-center text-green-700 dark:text-green-400"><ArrowUp className="!size-3" />{aheadCount}</span>}
          {behindCount > 0 && <span className="flex items-center text-amber-600 dark:text-amber-400"><ArrowDown className="!size-3" />{behindCount}</span>}
        </button>
        <button type="button" className="vessel-status-separated" data-title={identity?.email ? `提交者：${identity.name} <${identity.email}>，点击修改` : "未配置提交者，点击设置"} onClick={() => setRepositorySettingsOpen(true)}>
          <User />
          <span className="max-w-40 truncate">{identity?.name || "未配置提交者"}</span>
        </button>
      </>}
    >
      {ready && head && (
        <footer aria-label="最近提交" className="vessel-document-stats" data-title-side="top" data-title={`${head.shortHash} · ${head.author} · ${head.date}\n${head.message}`}>
          <span className="min-w-0 !shrink">
            <GitCommitHorizontal className="shrink-0" />
            <code className="shrink-0 text-stone-400">{head.shortHash}</code>
            <span className="min-w-0 max-w-[28rem] truncate">{head.message}</span>
          </span>
          <span className="vessel-status-separated">
            <Clock />
            {relativeTime(head.timestamp, head.date)}
          </span>
        </footer>
      )}
    </StatusBar>
  )
}
