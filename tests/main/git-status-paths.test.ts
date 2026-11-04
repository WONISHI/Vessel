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
