import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { GitService } from "@main/modules/git/git-service"

it("uses the same first-parent baseline for merge file statistics and patches", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-merge-diff-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  try {
    git("init", "-b", "main")
    git("config", "user.name", "Test")
    git("config", "user.email", "test@example.com")
    await writeFile(join(root, "changed.ts"), "base\n")
    await writeFile(join(root, "removed.ts"), "remove me\n")
    git("add", "."); git("commit", "-m", "root")
    const initial = git("rev-parse", "HEAD")
    git("checkout", "-b", "incoming")
    await writeFile(join(root, "changed.ts"), "incoming\n")
    await unlink(join(root, "removed.ts"))
    git("add", "-A"); git("commit", "-m", "incoming change")
    git("checkout", "main")
    await writeFile(join(root, "local.ts"), "local\n")
    git("add", "."); git("commit", "-m", "local change")
    git("merge", "--no-ff", "--no-edit", "incoming")
    const merge = git("rev-parse", "HEAD")
    const service = new GitService()
    const detail = await service.getCommitDetail(root, merge)
    expect(detail.parents).toHaveLength(2)
    expect(detail.files).toEqual([
      { path: "changed.ts", status: "M", additions: 1, deletions: 1 },
      { path: "removed.ts", status: "D", additions: 0, deletions: 1 }
    ])
    const modified = await service.getDiff(root, "changed.ts", false, merge)
    expect(modified.diff).toContain("-base\n+incoming")
    const removed = await service.getDiff(root, "removed.ts", false, merge)
    expect(removed.diff).toContain("-remove me")
    expect((await service.getDiff(root, "changed.ts", false, initial)).diff).toContain("+base")
    await expect(service.getDiff(root, "changed.ts", false, "invalid-commit")).rejects.toThrow()
  } finally { await rm(root, { recursive: true, force: true }) }
})
