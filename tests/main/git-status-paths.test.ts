import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile, rename } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { GitService } from "@main/modules/git/git-service"

it("保留中文、空格及特殊字符路径，并正确解析重命名的源和目标", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-git-paths-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root })
  try {
    git("init", "-b", "main")
    git("config", "user.name", "Test"); git("config", "user.email", "test@example.com")
    const oldName = "原文件.md", newName = "新的 中文文件.md"
    await writeFile(join(root, oldName), "unchanged content\n")
    git("add", "--", oldName); git("commit", "-m", "initial")
    await rename(join(root, oldName), join(root, newName))
    git("add", "-A")
    const names = ["第一轮内存优化.md", " file -> name.md ", '引号"与\\反斜杠.md', "换行\n文件.md"]
    for (const name of names) await writeFile(join(root, name), "content")
    const service = new GitService()
    let status = await service.getStatus(root)
    expect(status.branch).toBe("main")
    expect(status.staged).toContainEqual({ path: newName, oldPath: oldName, status: "R" })
    expect(status.untracked.map(f => f.path).sort()).toEqual(names.sort())
    await service.stage(root, names)
    status = await service.getStatus(root)
    expect(status.staged.map(f => f.path)).toEqual(expect.arrayContaining(names))
    await service.unstage(root, names)
    status = await service.getStatus(root)
    expect(status.untracked.map(f => f.path).sort()).toEqual(names.sort())
  } finally { await rm(root, { recursive: true, force: true }) }
})

it("reads Git's pending merge message through conflict resolution and ignores stale messages after abort", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-git-merge-message-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" })
  try {
    git("init", "-b", "main")
    git("config", "user.name", "Test"); git("config", "user.email", "test@example.com")
    await writeFile(join(root, "file.txt"), "base\n")
    git("add", "."); git("commit", "-m", "initial")
    git("checkout", "-b", "dev")
    await writeFile(join(root, "file.txt"), "dev\n")
    git("commit", "-am", "dev")
    git("checkout", "main")
    await writeFile(join(root, "file.txt"), "main\n")
    git("commit", "-am", "main")
    expect(() => git("merge", "dev")).toThrow()
    const service = new GitService()
    let status = await service.getStatus(root)
    expect(status.mergeMessage).toBe("Merge branch 'dev'")
    expect(status.conflicts).toHaveLength(1)
    await writeFile(join(root, "file.txt"), "resolved\n")
    git("add", ".")
    status = await service.getStatus(root)
    expect(status.conflicts).toHaveLength(0)
    expect(status.mergeMessage).toBe("Merge branch 'dev'")
    git("merge", "--abort")
    await writeFile(join(root, ".git", "MERGE_MSG"), "stale message")
    expect((await service.getStatus(root)).mergeMessage).toBeUndefined()
  } finally { await rm(root, { recursive: true, force: true }) }
})

it("reports separate index/worktree line counts, renamed paths and new text files without binary counts", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-git-line-stats-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" })
  try {
    git("init", "-b", "main")
    git("config", "user.name", "Test"); git("config", "user.email", "test@example.com")
    await writeFile(join(root, "partial.txt"), "one\ntwo\nthree\n")
    await writeFile(join(root, "old.txt"), Array.from({ length: 20 }, (_, i) => `${i}\n`).join(""))
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2]))
    git("add", "."); git("commit", "-m", "initial")
    await writeFile(join(root, "partial.txt"), "one\nTWO\nthree\nfour\n")
    await rename(join(root, "old.txt"), join(root, "重命名\t换行\n.txt"))
    await writeFile(join(root, "重命名\t换行\n.txt"), Array.from({ length: 20 }, (_, i) => `${i}\n`).join("") + "new\n")
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 3, 4]))
    git("add", "-A")
    await writeFile(join(root, "partial.txt"), "one\nTWO\nfour\n")
    await writeFile(join(root, "新文件\t换行\n.md"), "first\nsecond")
    await writeFile(join(root, "new.bin"), Buffer.from([0, 3, 4]))
    const status = await new GitService().getStatus(root)
    expect(status.staged.find(f => f.path === "partial.txt")).toMatchObject({ additions: 2, deletions: 1 })
    expect(status.unstaged.find(f => f.path === "partial.txt")).toMatchObject({ additions: 0, deletions: 1 })
    expect(status.staged.find(f => f.status === "R")).toMatchObject({ path: "重命名\t换行\n.txt", additions: 1, deletions: 0 })
    expect(status.untracked.find(f => f.path.endsWith(".md"))).toMatchObject({ additions: 2, deletions: 0 })
    for (const file of [...status.staged, ...status.untracked].filter(f => f.path.endsWith(".bin"))) {
      expect(file.additions).toBeUndefined()
      expect(file.deletions).toBeUndefined()
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})
