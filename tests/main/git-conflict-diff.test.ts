import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { GitService } from "@main/modules/git/git-service"

it("returns a two-way conflict diff without changing the worktree or resolving the index", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-conflict-diff-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe", encoding: "utf8" })
  const file = "冲突 文件.vue"
  try {
    git("init", "-b", "main")
    git("config", "user.name", "Test"); git("config", "user.email", "test@example.com")
    await writeFile(join(root, file), "first\nbase\nlast\n")
    git("add", "."); git("commit", "-m", "initial")
    git("checkout", "-b", "other")
    await writeFile(join(root, file), "first\ntheirs\nlast\n")
    git("commit", "-am", "other")
    git("checkout", "main")
    await writeFile(join(root, file), "first\nours\nlast\n")
    git("commit", "-am", "ours")
    expect(() => git("merge", "other")).toThrow()
    expect(git("diff", "--", file)).toContain("diff --cc")
    const original = await readFile(join(root, file), "utf8")
    const index = git("ls-files", "--unmerged", "-z")
    const { diff } = await new GitService().getDiff(root, file)
    expect(diff).toContain("diff --git")
    expect(diff).toMatch(/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m)
    expect(diff).not.toMatch(/^diff --(?:cc|combined)|^@@@/m)
    expect(diff).toContain("+<<<<<<< HEAD")
    expect(diff).toContain("+=======")
    expect(diff).toContain("+>>>>>>> other")
    expect(diff).toContain("+theirs")
    expect(await readFile(join(root, file), "utf8")).toBe(original)
    expect(git("ls-files", "--unmerged", "-z")).toBe(index)
  } finally { await rm(root, { recursive: true, force: true }) }
})
