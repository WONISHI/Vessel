import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { searchGitCommits } from "@main/modules/git/search"

it("searches all fields with paging, literal text and inclusive date ranges", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-git-search-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  try {
    git("init", "--quiet", "-b", "master")
    git("config", "user.name", "Search User")
    git("config", "user.email", "search@example.test")
    const commit = async (name: string, message: string, date: string) => {
      await writeFile(join(root, name), message)
      git("add", ".")
      execFileSync("git", ["-c", "commit.gpgSign=false", "commit", "--quiet", "-m", message], { cwd: root, env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } })
      return git("rev-parse", "HEAD")
    }
    const first = await commit("hello.ts", "fix | first [x]", "2026-10-01T10:00:00+0800")
    git("branch", "feature/search")
    await commit("another.ts", "fix second", "2026-11-01T10:00:00+0800")
    expect((await searchGitCommits(root, { query: "fix", field: "message", limit: 1 })).hasMore).toBe(true)
    expect((await searchGitCommits(root, { query: "fix", field: "message", limit: 1, skip: 1 })).commits[0].message).toBe("fix | first [x]")
    expect((await searchGitCommits(root, { query: "[x]", field: "message" })).commits).toHaveLength(1)
    expect((await searchGitCommits(root, { query: first.slice(0, 8), field: "sha" })).commits[0].hash).toBe(first)
    expect((await searchGitCommits(root, { query: "feature/search", field: "branch" })).commits.map((item) => item.hash)).toEqual([first])
    expect((await searchGitCommits(root, { query: "hello", field: "file" })).commits.map((item) => item.hash)).toEqual([first])
    expect((await searchGitCommits(root, { query: "search@example", field: "author" })).commits).toHaveLength(2)
    expect((await searchGitCommits(root, { query: "fix", field: "message", from: "2026-10-01", to: "2026-10-01" })).commits[0].hash).toBe(first)
    await expect(searchGitCommits(root, { query: "fix", field: "message", from: "2026-11-02", to: "2026-10-01" })).rejects.toThrow("起始日期")
    expect((await searchGitCommits(root, { query: "--all", field: "sha" })).commits).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})
