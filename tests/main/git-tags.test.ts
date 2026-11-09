import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { gitService } from "@main/modules/git/git-service"

it("creates annotated and lightweight tags at selected commits and pushes only the selected tag", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-tags-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  try {
    git("init", "--quiet")
    git("config", "user.name", "Tag Test")
    git("config", "user.email", "tag@example.test")
    git("config", "tag.gpgSign", "true")
    await writeFile(join(root, "readme"), "one")
    git("add", ".")
    git("-c", "commit.gpgSign=false", "commit", "--quiet", "-m", "one")
    const first = git("rev-parse", "HEAD")
    await gitService.createTag(root, "v1", first, { message: "release notes" })
    expect(git("cat-file", "-t", "refs/tags/v1")).toBe("tag")
    expect(git("for-each-ref", "--format=%(contents)", "refs/tags/v1")).toBe("release notes")
    await gitService.createTag(root, "light", first, { lightweight: true })
    expect(git("cat-file", "-t", "refs/tags/light")).toBe("commit")
    await expect(gitService.createTag(root, "v1", first, {})).rejects.toThrow()
    await gitService.createTag(root, "v1", first, { force: true, message: "updated" })
    const remote = join(root, "remote.git")
    git("init", "--bare", "--quiet", remote)
    git("remote", "add", "origin", remote)
    await gitService.pushTag(root, "origin", "v1")
    expect(git("ls-remote", "--tags", "origin")).toContain("refs/tags/v1")
    expect(git("ls-remote", "--tags", "origin")).not.toContain("refs/tags/light")
    await gitService.deleteTag(root, "light")
    expect(await gitService.getTags(root)).toEqual(["v1"])
    await gitService.deleteRemoteTag(root, "origin", "v1")
    expect(git("ls-remote", "--tags", "origin")).not.toContain("refs/tags/v1")
    await gitService.deleteRemoteTag(root, "origin", "v1")
    await expect(gitService.createTag(root, "-bad", first, {})).rejects.toThrow()
  } finally { await rm(root, { recursive: true, force: true }) }
})
