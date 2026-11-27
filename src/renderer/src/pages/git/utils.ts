import type { GitCommitItem } from "@vessel/type"
/**
 * Git 页独立记住的当前仓库路径（跨路由切走再回来仍恢复选中项）
 */
export const GIT_CURRENT_REPO_KEY = "vessel:git-current-repo"
export const GIT_REPOSITORIES_KEY = "vessel:git-repositories"
export type GitRepository = { name: string; path: string }

export function getSavedGitRepositories(): GitRepository[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(GIT_REPOSITORIES_KEY) || "[]")
    return Array.isArray(saved) ? saved.filter((item): item is GitRepository => typeof item?.path === "string" && !!item.path && typeof item?.name === "string") : []
  } catch { return [] }
}

/** Writes the selected Git repo path so remounts restore the same label. */
export function persistGitRepoPath(path: string): void {
  try {
    if (path) localStorage.setItem(GIT_CURRENT_REPO_KEY, path)
    else localStorage.removeItem(GIT_CURRENT_REPO_KEY)
  } catch { /* Storage may be unavailable; the current selection remains usable. */ }
}

/**
 * 只恢复在 Git 页面明确添加过的仓库，不从工作区或资源库选取默认值。
 */
export function getInitialRepoPath(): string {
  try {
    const saved = localStorage.getItem(GIT_CURRENT_REPO_KEY)
    if (saved && getSavedGitRepositories().some(item => item.path === saved)) return saved
  } catch { /* Start without a repository when the saved selection cannot be read. */ }

  return ""
}

/** Performs the clean git error message operation. */
export function cleanGitErrorMessage(e: any): string {
  if (!e) return "未知错误"
  const msg = typeof e === "string" ? e : e.message || String(e)
  return msg
    .replace(/^Error invoking remote method '[^']+':\s*/, "")
    .replace(/^Error:\s*/, "")
    .trim()
}

/** Finds the history-row index whose decorated refs tip-match this branch name. */
export function findCommitIndexForBranch(commits: GitCommitItem[], branch: string): number {
  if (!branch) return -1
  const headRef = `HEAD -> ${branch}`
  return commits.findIndex((commit) =>
    commit.refs.some((ref) => ref === branch || ref === headRef)
  )
}
