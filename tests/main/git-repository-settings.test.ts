import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { getRepositorySettings, saveRepositorySettings } from "@main/modules/git/repository-settings"

it("persists local templates, remotes, identity and ignore rules and rejects invalid drafts before changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-settings-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  try {
    git("init", "--quiet")
    const draft = {
      ...(await getRepositorySettings(root)),
      templateMode: "custom" as const,
      template: "feat: \n\nValidation:\n",
      useGlobalIdentity: false,
      userName: "Test User",
      userEmail: "test@example.com",
      signCommits: false,
      signingKey: "",
      remotes: [{ name: "origin", url: "https://example.com/team/repo.git" }],
      ignore: "node_modules/\n"
    }
    await saveRepositorySettings(root, draft)
    expect(await getRepositorySettings(root)).toMatchObject(draft)
    expect(git("config", "--local", "user.name")).toBe("Test User")
    expect(await readFile(join(root, ".gitignore"), "utf8")).toBe(draft.ignore)
    await expect(saveRepositorySettings(root, { ...draft, remotes: [{ name: "invalid name", url: "x" }] })).rejects.toThrow()
    expect(git("remote", "get-url", "origin")).toBe(draft.remotes[0].url)
    await saveRepositorySettings(root, { ...draft, templateMode: "none", remotes: [] })
    expect(await getRepositorySettings(root)).toMatchObject({ templateMode: "none", template: "", remotes: [] })
    await saveRepositorySettings(root, { ...draft, templateMode: "default", useGlobalIdentity: true, remotes: [] })
    expect(await getRepositorySettings(root)).toMatchObject({ templateMode: "default", useGlobalIdentity: true })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
