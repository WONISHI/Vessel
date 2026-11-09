import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { gitService } from "@main/modules/git/git-service"

it("stashes only the selected files and can keep staged changes in the index", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-stash-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  try {
    git("init", "--quiet")
    git("config", "user.name", "Stash Test")
    git("config", "user.email", "stash@example.test")
    for (const name of ["a", "b", "c"]) await writeFile(join(root, name), "base")
    git("add", ".")
    git("-c", "commit.gpgSign=false", "commit", "--quiet", "-m", "base")
    for (const name of ["a", "b", "c"]) await writeFile(join(root, name), "changed")
    await writeFile(join(root, "new"), "untracked")

    await gitService.stashSave(root, "pick two", ["a", "new"])
    expect(await readFile(join(root, "a"), "utf8")).toBe("base")
    expect(await readFile(join(root, "b"), "utf8")).toBe("changed")
    expect(git("status", "--porcelain", "--untracked-files=all")).not.toContain("new")
    expect(git("stash", "list")).toContain("pick two")

    git("add", "b")
    await gitService.stashSave(root, "keep", ["b", "c"], { keepIndex: true })
    expect(await readFile(join(root, "b"), "utf8")).toBe("changed")
    expect(await readFile(join(root, "c"), "utf8")).toBe("base")
  } finally { await rm(root, { recursive: true, force: true }) }
})
