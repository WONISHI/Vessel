import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it, vi } from "vitest"
import { gitService } from "@main/modules/git/git-service"

const directories: string[] = []
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(directories.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "vessel-stash-conflicts-"))
  directories.push(root)
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  git("init", "-b", "main", "--quiet")
  git("config", "user.name", "Test"); git("config", "user.email", "test@example.test")
  git("config", "commit.gpgSign", "false"); git("config", "core.hooksPath", "/dev/null")
  const write = (name: string, content: string) => writeFile(join(root, name), content)
  await write("冲突 文件.md", "base\n"); await write("safe.md", "base\n")
  git("add", "."); git("commit", "--quiet", "-m", "base")
  return { root, git, write }
}

it("pops a clean stash and restores tracked and untracked files", async () => {
  const { root, git, write } = await fixture()
  await write("safe.md", "changed\n"); await write("new.md", "untracked\n")
  await gitService.stashSave(root, "clean")
  expect(await gitService.stashPop(root)).toMatchObject({ conflicts: [], dropped: true })
  expect(git("stash", "list")).toBe("")
  expect(await readFile(join(root, "new.md"), "utf8")).toBe("untracked\n")
})

it.each([false, true])("retains an applied stash with conflicts (also has clean changes: %s), then stages the resolved file", async (mixed) => {
  const { root, git, write } = await fixture()
  await write("冲突 文件.md", "stashed version\n")
  if (mixed) await write("safe.md", "restored version\n")
  await gitService.stashSave(root, "conflicting stash")
  await write("冲突 文件.md", "current version\n")
  git("add", "--", "冲突 文件.md"); git("commit", "--quiet", "-m", "current")
  const result = await gitService.stashPop(root)
  expect(result).toMatchObject({ conflicts: ["冲突 文件.md"], dropped: false })
  expect(git("stash", "list")).toContain("conflicting stash")
  const status = await gitService.getStatus(root)
  expect(status.conflicts).toEqual([{ path: "冲突 文件.md", status: "U" }])
  expect(status.unstaged.some((file) => file.path === "冲突 文件.md")).toBe(false)
  expect(await readFile(join(root, "冲突 文件.md"), "utf8")).toContain("<<<<<<<")
  if (mixed) expect(await readFile(join(root, "safe.md"), "utf8")).toBe("restored version\n")
  await write("冲突 文件.md", "resolved version\n")
  await gitService.stage(root, ["冲突 文件.md"])
  const resolved = await gitService.getStatus(root)
  expect(resolved.conflicts).toEqual([])
  expect(resolved.staged).toContainEqual(expect.objectContaining({ path: "冲突 文件.md", status: "M" }))
})

it("retains both the selected non-top stash and newer records after a conflict", async () => {
  const { root, git, write } = await fixture()
  await write("冲突 文件.md", "older stash\n"); await gitService.stashSave(root, "selected old")
  await write("safe.md", "newer stash\n"); await gitService.stashSave(root, "keep new")
  const keep = git("rev-parse", "stash@{0}")
  await write("冲突 文件.md", "current\n"); git("add", "."); git("commit", "--quiet", "-m", "current")
  await gitService.stashPop(root, 1)
  expect(git("stash", "list")).toContain("keep new")
  expect(git("stash", "list")).toContain("selected old")
  expect(git("rev-parse", "stash@{0}")).toBe(keep)
})

it("refuses an untracked path collision before applying any tracked changes", async () => {
  const { root, git, write } = await fixture()
  await write("冲突 文件.md", "stashed\n"); await write("new.md", "stashed untracked\n")
  await gitService.stashSave(root, "must keep")
  const hash = git("rev-parse", "stash@{0}")
  await write("冲突 文件.md", "current\n"); git("add", "."); git("commit", "--quiet", "-m", "current")
  await write("new.md", "local untracked\n")
  await expect(gitService.stashPop(root)).rejects.toThrow(/已有本地修改/)
  expect(git("rev-parse", "stash@{0}")).toBe(hash)
  expect(await readFile(join(root, "new.md"), "utf8")).toBe("local untracked\n")
  expect(await readFile(join(root, "冲突 文件.md"), "utf8")).toBe("current\n")
  expect((await gitService.getStatus(root)).conflicts).toHaveLength(0)
})

it("preserves an unapplied stash and refuses another pop while conflicts already exist", async () => {
  const { root, git, write } = await fixture()
  await write("冲突 文件.md", "stashed\n"); await gitService.stashSave(root, "keep")
  const hash = git("rev-parse", "stash@{0}")
  await write("冲突 文件.md", "local unsaved\n")
  await expect(gitService.stashPop(root)).rejects.toThrow(/已有本地修改/)
  expect(git("rev-parse", "stash@{0}")).toBe(hash)
  expect(await readFile(join(root, "冲突 文件.md"), "utf8")).toBe("local unsaved\n")
  git("add", "."); git("commit", "--quiet", "-m", "current")
  try { git("stash", "apply", hash) } catch { /* Expected merge conflict. */ }
  await expect(gitService.stashPop(root)).rejects.toThrow("请先解决当前冲突")
  expect(git("rev-parse", "stash@{0}")).toBe(hash)
  await expect(gitService.stashPop(root, -1)).rejects.toThrow("贮藏编号无效")
})

it.each([false, true])("applies without dropping the record (conflict: %s)", async (conflict) => {
  const { root, git, write } = await fixture()
  await write("冲突 文件.md", "saved version\n")
  await gitService.stashSave(root, "keep on apply")
  const hash = git("rev-parse", "stash@{0}")
  if (conflict) { await write("冲突 文件.md", "current\n"); git("add", "."); git("commit", "--quiet", "-m", "current") }
  const result = await gitService.stashApply(root)
  expect(result.dropped).toBe(false)
  expect(result.conflicts.length).toBe(conflict ? 1 : 0)
  expect(git("rev-parse", "stash@{0}")).toBe(hash)
  expect((await gitService.getStashes(root))[0].hash).toBe(hash)
})

it.each(["pop", "apply"] as const)("%s refuses overlapping staged changes and preserves both versions", async (operation) => {
  const { root, git, write } = await fixture()
  await write("safe.md", "stashed\n")
  await gitService.stashSave(root, "original record")
  const hash = git("rev-parse", "stash@{0}")
  await write("safe.md", "staged current\n"); git("add", "--", "safe.md")
  await write("safe.md", "unstaged current\n")
  const originalIndex = git("write-tree")
  await expect(operation === "pop" ? gitService.stashPop(root) : gitService.stashApply(root)).rejects.toThrow(/safe.md/)
  expect(git("write-tree")).toBe(originalIndex)
  expect(await readFile(join(root, "safe.md"), "utf8")).toBe("unstaged current\n")
  expect(git("rev-parse", "stash@{0}")).toBe(hash)
})

it.each(["pop", "apply"] as const)("%s preserves unrelated staged/unstaged files while merging stash changes", async (operation) => {
  const { root, git, write } = await fixture()
  await write("safe.md", "stashed\n"); await gitService.stashSave(root, "safe merge")
  await write("冲突 文件.md", "staged local\n"); git("add", "--", "冲突 文件.md")
  await write("冲突 文件.md", "unstaged local\n")
  await write("other.txt", "local untracked\n")
  const result = await (operation === "pop" ? gitService.stashPop(root) : gitService.stashApply(root))
  expect(result).toMatchObject({ conflicts: [], dropped: operation === "pop" })
  expect(await readFile(join(root, "safe.md"), "utf8")).toBe("stashed\n")
  expect(await readFile(join(root, "冲突 文件.md"), "utf8")).toBe("unstaged local\n")
  expect(git("show", ":冲突 文件.md")).toBe("staged local")
  expect(await readFile(join(root, "other.txt"), "utf8")).toBe("local untracked\n")
})

it("refuses to apply a different stash when its displayed ordinal has changed", async () => {
  const { root, git, write } = await fixture()
  await write("safe.md", "old\n"); await gitService.stashSave(root, "selected")
  const selected = git("rev-parse", "stash@{0}")
  await write("safe.md", "new\n"); await gitService.stashSave(root, "newer")
  const before = git("stash", "list")
  await expect(gitService.stashPop(root, 0, selected)).rejects.toThrow("贮藏列表已变化")
  expect(git("stash", "list")).toBe(before)
  expect(await readFile(join(root, "safe.md"), "utf8")).toBe("base\n")
})

it("rejects overlapping renames using both the old and new paths", async () => {
  const { root, git, write } = await fixture()
  await write("safe.md", "stashed\n"); await gitService.stashSave(root, "rename collision")
  git("mv", "safe.md", "renamed.md")
  const originalIndex = git("write-tree")
  await expect(gitService.stashPop(root)).rejects.toThrow("safe.md")
  expect(git("write-tree")).toBe(originalIndex)
  expect(await readFile(join(root, "renamed.md"), "utf8")).toBe("base\n")
  expect((await gitService.getStashes(root))).toHaveLength(1)
})

it("protects ignored files before restoring a stash with multiple files", async () => {
  const { root, git, write } = await fixture()
  await write("safe.md", "stashed\n"); await write("local.txt", "saved untracked\n")
  await gitService.stashSave(root, "ignored collision")
  await write(".gitignore", "local.txt\n"); git("add", "."); git("commit", "--quiet", "-m", "ignore")
  await write("local.txt", "ignored local\n")
  expect((await gitService.getStatus(root)).untracked).toEqual([])
  await expect(gitService.stashPop(root)).rejects.toThrow("local.txt")
  expect(await readFile(join(root, "safe.md"), "utf8")).toBe("base\n")
  expect(await readFile(join(root, "local.txt"), "utf8")).toBe("ignored local\n")
  expect((await gitService.getStashes(root))).toHaveLength(1)
})

it("serializes restores for the same repository and releases its guard on failure", async () => {
  const { root, write } = await fixture()
  await write("safe.md", "stashed\n"); await gitService.stashSave(root, "one restore")
  const getStatus = gitService.getStatus.bind(gitService)
  let release!: () => void
  const paused = new Promise<void>((resolve) => { release = resolve })
  const status = vi.spyOn(gitService, "getStatus").mockImplementationOnce(async (cwd) => { await paused; return getStatus(cwd) })
  const first = gitService.stashApply(root)
  await vi.waitFor(() => expect(status).toHaveBeenCalledOnce())
  await expect(gitService.stashPop(root)).rejects.toThrow("正在恢复贮藏")
  release(); await first
  // The first restore left a dirty file, so a retry must reach the overlap check.
  await expect(gitService.stashPop(root)).rejects.toThrow("已有本地修改")
  await expect(gitService.stashPop(root)).rejects.toThrow("已有本地修改")
})

it("refuses a second stash affecting the first restored file instead of replacing it", async () => {
  const { root, git, write } = await fixture()
  await write("safe.md", "first version\n"); await gitService.stashSave(root, "first")
  await write("safe.md", "second version\n"); await gitService.stashSave(root, "second")
  await gitService.stashApply(root, 1)
  await expect(gitService.stashPop(root, 0)).rejects.toThrow("已有本地修改")
  expect(await readFile(join(root, "safe.md"), "utf8")).toBe("first version\n")
  expect((await gitService.getStashes(root))).toHaveLength(2)
  expect(git("status", "--porcelain")).toContain("safe.md")
})

it("keeps both sides when committed changes conflict, even with a learned rerere resolution", async () => {
  const { root, git, write } = await fixture()
  git("config", "rerere.enabled", "true")
  git("config", "rerere.autoupdate", "true")
  await write("safe.md", "stashed\n"); await gitService.stashSave(root, "keep both")
  await write("safe.md", "committed current\n"); git("add", "."); git("commit", "--quiet", "-m", "current")
  try { git("stash", "apply") } catch { /* Teach Git an earlier resolution that must not be reused. */ }
  await write("safe.md", "previous automatic choice\n"); git("rerere")
  git("reset", "--hard", "HEAD")
  const result = await gitService.stashPop(root)
  expect(result).toMatchObject({ conflicts: ["safe.md"], dropped: false })
  const merged = await readFile(join(root, "safe.md"), "utf8")
  expect(merged).toContain("<<<<<<<")
  expect(merged).toContain("committed current")
  expect(merged).toContain("stashed")
  expect(merged).not.toContain("previous automatic choice")
  expect((await gitService.getStashes(root))).toHaveLength(1)
})

it("previews saved tracked, index-only and untracked files without touching current changes", async () => {
  const { root, git, write } = await fixture()
  git("mv", "--", "冲突 文件.md", "新的 文件.md")
  await write("safe.md", "index-only version\n"); git("add", "--", "safe.md"); await write("safe.md", "base\n")
  await write("附件 中文.txt", "saved untracked text\n")
  await writeFile(join(root, "换行\n图片.bin"), Buffer.from([0, 1, 2, 3]))
  await gitService.stashSave(root, "preview saved trees")
  const hash = git("rev-parse", "stash@{0}")
  await write("冲突 文件.md", "current worktree must stay untouched\n")
  const before = git("status", "--porcelain", "-z")
  const detail = await gitService.getStashDetail(root, 0)
  expect(detail.hash).toBe(hash)
  expect(detail.files).toEqual(expect.arrayContaining([
    { path: "新的 文件.md", oldPath: "冲突 文件.md", status: "R", source: "worktree" },
    { path: "safe.md", status: "M", source: "index" },
    { path: "附件 中文.txt", status: "?", source: "untracked" },
    { path: "换行\n图片.bin", status: "?", source: "untracked" }
  ]))
  expect((await gitService.getStashDiff(root, hash, "safe.md")).diff).toContain("index-only version")
  expect((await gitService.getStashDiff(root, hash, "附件 中文.txt")).diff).toContain("saved untracked text")
  expect((await gitService.getStashDiff(root, hash, "换行\n图片.bin")).diff).toContain("Binary files")
  expect(git("status", "--porcelain", "-z")).toBe(before)
  expect(git("rev-parse", "stash@{0}")).toBe(hash)
  await gitService.stashSave(root, "newer entry")
  expect((await gitService.getStashDetail(root, hash)).hash).toBe(hash)
  expect((await gitService.getStashDiff(root, hash, "附件 中文.txt")).diff).toContain("saved untracked text")
  await expect(gitService.getStashDiff(root, hash, "not-saved.md")).rejects.toThrow("文件不在此贮藏中")
  await expect(gitService.getStashDetail(root, "--all")).rejects.toThrow("贮藏标识无效")
})
