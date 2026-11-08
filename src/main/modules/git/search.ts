import type { GitSearchOptions, GitSearchResult } from "@vessel/type/git"
import { runGit } from "./git-service"

/** Search the repository, not just the first page loaded by the history UI. */
export async function searchGitCommits(cwd: string, options: GitSearchOptions): Promise<GitSearchResult> {
  const empty = { commits: [], hasMore: false }
  if (!options || typeof options.query !== "string" || options.query.length > 500) throw new Error("搜索关键词无效")
  const query = options.query.trim()
  if (!query) return empty
  if (!["message", "sha", "branch", "file", "author"].includes(options.field)) throw new Error("搜索类型无效")
  const limit = Math.max(1, Math.min(200, Math.floor(options.limit || 100)))
  const skip = Math.max(0, Math.floor(options.skip || 0))
  const args = ["log", "--date-order", "--fixed-strings", "--regexp-ignore-case", `--max-count=${limit + 1}`, `--skip=${skip}`, "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%D%x1e"]
  for (const [date, end] of [[options.from, false], [options.to, true]] as const) {
    if (!date) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error("搜索日期无效")
    args.push(`${end ? "--until" : "--since-as-filter"}=${date}T${end ? "23:59:59" : "00:00:00"}`)
  }
  if (options.from && options.to && options.from > options.to) throw new Error("起始日期不能晚于结束日期")
  let revisions = ["--all"]
  let paths: string[] = []
  if (options.field === "message") args.push(`--grep=${query}`)
  if (options.field === "author") args.push(`--author=${query}`)
  if (options.field === "branch") {
    const refs = await runGit(["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"], cwd)
    if (refs.exitCode !== 0) throw new Error(refs.stderr || "读取分支失败")
    revisions = refs.stdout.trim().split("\n").filter((ref) => ref.toLowerCase().includes(query.toLowerCase()))
    if (!revisions.length) return empty
  }
  if (options.field === "sha") {
    if (!/^[a-f\d]{4,40}$/i.test(query)) return empty
    const objects = await runGit(["rev-parse", `--disambiguate=${query.toLowerCase()}`], cwd)
    revisions = []
    for (const object of objects.stdout.trim().split("\n").filter(Boolean)) {
      const type = await runGit(["cat-file", "-t", object], cwd)
      if (type.stdout.trim() === "commit") revisions.push(object)
    }
    if (!revisions.length) return empty
    args.push("--no-walk")
  }
  if (options.field === "file") {
    const literal = query.replace(/[?*\[\]]/g, (character) => ({ "?": "[?]", "*": "[*]", "[": "[[]", "]": "[]]" }[character]!))
    paths = [`:(icase,glob)**/*${literal}*`]
    args.push("--full-history")
  }
  const result = await runGit([...args, ...revisions, "--", ...paths], cwd)
  if (result.exitCode !== 0) throw new Error(result.stderr || "搜索提交失败")
  const commits = result.stdout.split("\x1e").map((record) => record.trim()).filter(Boolean).map((record) => {
    const [hash, parents, author, email, seconds, message, refs = ""] = record.split("\x1f")
    const timestamp = Number(seconds) * 1000
    return { hash, shortHash: hash.slice(0, 7), parents: parents ? parents.split(" ") : [], author, email, timestamp, message, refs: refs.split(",").map((ref) => ref.trim()).filter(Boolean), date: new Date(timestamp).toLocaleString("zh-CN") }
  })
  return { commits: commits.slice(0, limit), hasMore: commits.length > limit }
}
