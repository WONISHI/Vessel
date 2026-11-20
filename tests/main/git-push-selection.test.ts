import { execFileSync } from "node:child_process"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { gitService } from "../../src/main/modules/git/git-service"

it("pushes only selected branches, maps destinations, sets tracking and explicitly opts into tags", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vessel-push-"))
  const source = join(directory, "source"), remote = join(directory, "remote.git")
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  try {
    await mkdir(source)
    git(source, "init", "--quiet", "--initial-branch=main")
    git(source, "config", "user.name", "Test")
    git(source, "config", "user.email", "test@example.com")
    git(source, "config", "commit.gpgsign", "false")
    git(source, "commit", "--quiet", "--allow-empty", "-m", "fixture")
    git(source, "branch", "dev")
    git(source, "branch", "unselected")
    git(source, "-c", "tag.gpgsign=false", "tag", "fixture-tag")
    git(directory, "init", "--quiet", "--bare", remote)
    git(source, "remote", "add", "origin", remote)
    const info = await gitService.getPushInfo(source)
    expect(info.remotes).toEqual([{ name: "origin", url: remote }])
    expect(info.branches.find((branch) => branch.name === "main")?.current).toBe(true)
    await gitService.pushSelection(source, { remote: "origin", branches: [{ local: "dev", remote: "review/dev", track: true }], tags: false })
    expect(git(remote, "rev-parse", "refs/heads/review/dev")).toBe(git(source, "rev-parse", "dev"))
    expect(() => git(remote, "show-ref", "--verify", "refs/heads/unselected")).toThrow()
    expect(() => git(remote, "show-ref", "--verify", "refs/tags/fixture-tag")).toThrow()
    expect(git(source, "config", "branch.dev.remote")).toBe("origin")
    expect(git(source, "config", "branch.dev.merge")).toBe("refs/heads/review/dev")
    await expect(gitService.pushSelection(source, { remote: "origin", branches: [{ local: "main", remote: "bad..ref", track: false }], tags: false })).rejects.toThrow("名称无效")
    await expect(gitService.pushSelection(source, { remote: "missing", branches: [{ local: "main", remote: "main", track: false }], tags: false })).rejects.toThrow("远程仓库不存在")
    await gitService.pushSelection(source, { remote: "origin", branches: [], tags: true })
    expect(git(remote, "rev-parse", "refs/tags/fixture-tag")).toBe(git(source, "rev-parse", "fixture-tag"))
    git(source, "commit", "--quiet", "--allow-empty", "-m", "remote advance")
    git(source, "push", "origin", "HEAD:refs/heads/review/dev")
    const advanced = git(remote, "rev-parse", "refs/heads/review/dev")
    await expect(gitService.pushSelection(source, { remote: "origin", branches: [{ local: "dev", remote: "review/dev", track: false }], tags: false })).rejects.toThrow(/rejected|non-fast-forward/)
    expect(git(remote, "rev-parse", "refs/heads/review/dev")).toBe(advanced)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
