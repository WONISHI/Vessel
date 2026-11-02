/**
 * Git 页独立记住的当前仓库路径（跨路由切走再回来仍恢复选中项）
 */
export const GIT_CURRENT_REPO_KEY = "vessel:git-current-repo"

/** Writes the selected Git repo path so remounts restore the same label. */
export function persistGitRepoPath(path: string): void {
  try {
    if (path) localStorage.setItem(GIT_CURRENT_REPO_KEY, path)
    else localStorage.removeItem(GIT_CURRENT_REPO_KEY)
  } catch {}
}

/**
 * 优先读取 Git 页上次选中的仓库，其次项目资源库 / 固定项 / 工作区
 */
export function getInitialRepoPath(): string {
  try {
    const saved = localStorage.getItem(GIT_CURRENT_REPO_KEY)
    if (saved) return saved
  } catch {}

  try {
    const resource = JSON.parse(localStorage.getItem("resource_current_project") || "null")
    if (resource?.path) return resource.path
  } catch {}

  try {
    const meta = JSON.parse(localStorage.getItem("vessel:library-meta") || "{}")
    if (meta?.lastPinned?.path) return meta.lastPinned.path
    if (meta?.pins?.[0]?.path) return meta.pins[0].path
  } catch {}

  try {
    const ws = JSON.parse(localStorage.getItem("app_current_workspace") || "null")
    if (ws?.path) return ws.path
  } catch {}

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
