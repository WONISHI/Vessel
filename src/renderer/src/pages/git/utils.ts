/**
 * 优先读取项目资源库中打开的项目路径
 */
export function getInitialRepoPath(): string {
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
