import { runGit } from "./git-service"

export type GitDecorationCode = "M" | "A" | "U" | "D" | "C" | "R"
export type GitDecorations = { entries: { path: string; code: GitDecorationCode }[] } | null

function codeOf(xy: string): GitDecorationCode {
  if (xy === "??") return "U"
  if (xy.includes("U") || xy === "AA" || xy === "DD") return "C"
  if (xy.includes("D")) return "D"
  if (xy[0] === "R" || xy[0] === "C") return "R"
  if (xy[0] === "A") return "A"
  return "M"
}

/** Read-only (no optional locks): refreshing the index here would trigger the Git page watcher and loop. One porcelain pass for the file tree: paths are returned under the workspace folder (logical, forward slashes). */
export async function getGitDecorations(cwd: string): Promise<GitDecorations> {
  try {
    const prefix = (await runGit(["rev-parse", "--show-prefix"], cwd)).stdout.trim()
    const status = await runGit(["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=normal", "--", "."], cwd)
    const base = cwd.replace(/\\/g, "/").replace(/\/$/, "")
    const parts = status.stdout.split("\0")
    const entries: { path: string; code: GitDecorationCode }[] = []
    for (let index = 0; index < parts.length; index++) {
      const item = parts[index]
      if (item.length < 4) continue
      const xy = item.slice(0, 2)
      let rel = item.slice(3)
      if (xy[0] === "R" || xy[0] === "C") index++
      if (!rel.startsWith(prefix)) continue
      rel = rel.slice(prefix.length).replace(/\/$/, "")
      if (rel) entries.push({ path: `${base}/${rel}`, code: codeOf(xy) })
    }
    return { entries }
  } catch {
    return null
  }
}
