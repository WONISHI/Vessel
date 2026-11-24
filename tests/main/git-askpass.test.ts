import { createCredentialHandler } from "@main/modules/git/credential-handler"
import { createServer } from "node:http"
import { mkdtemp, rm, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
import { withGitAskpass, gitAuthenticationEnvironment } from "@main/modules/git/askpass"
import { runGit } from "@main/modules/git/git-service"
import { runCancellableGit } from "@main/modules/git/cancellable-git"

it("supplies HTTP credentials to bundled and cancellable Git without storing secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-auth-test-"))
  let expected = `Basic ${Buffer.from("test-user:test-token").toString("base64")}`
  let authorized = 0
  const server = createServer((request, response) => {
    if (request.headers.authorization !== expected) { response.writeHead(401, { "WWW-Authenticate": 'Basic realm="Git"' }).end(); return }
    authorized++
    response.writeHead(200, { "Content-Type": "text/plain" }).end(request.url === "/HEAD" ? "ref: refs/heads/main\n" : "")
  })
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
  try {
    const address = server.address() as { port: number }
    const args = ["-c", "credential.helper=", "ls-remote", `http://127.0.0.1:${address.port}/`]
    for (const run of [(args: string[]) => runGit(args, root), (args: string[]) => runCancellableGit(args, root, new AbortController().signal)]) {
      const prompt = vi.fn(async (value: string) => value.startsWith("Username") ? "test-user" : "test-token")
      let launcher = ""
      const result = await withGitAskpass(prompt, async () => {
        launcher = gitAuthenticationEnvironment().GIT_ASKPASS!
        return run(args)
      })
      expect(result.exitCode).toBe(0)
      expect(prompt.mock.calls.some(([value]) => value.startsWith("Username"))).toBe(true)
      expect(prompt.mock.calls.some(([value]) => value.startsWith("Password"))).toBe(true)
      expect(result.stdout + result.stderr).not.toContain("test-token")
      await expect(access(launcher)).rejects.toThrow()
      expect(gitAuthenticationEnvironment()).toEqual({})
    }
    // A local reset disables the user's system helpers without overriding our per-operation helper.
    await runGit(["init"], root)
    await runGit(["config", "credential.helper", ""], root)
    let saved: { username: string; password: string } | undefined
    const storage = {
      read: vi.fn(async () => saved),
      save: vi.fn(async (value: { username?: string; password?: string }) => { saved = { username: value.username!, password: value.password! } }),
      erase: vi.fn(async () => { saved = undefined })
    }
    const rejected = vi.fn(), warning = vi.fn()
    const credentials = createCredentialHandler(storage, rejected, warning)
    const networkArgs = args.slice(2)
    const prompt = vi.fn(async (value: string) => value.startsWith("Username") ? "test-user" : "test-token")
    expect((await withGitAskpass(prompt, () => runGit(networkArgs, root), credentials)).exitCode).toBe(0)
    expect(storage.save).toHaveBeenCalled()
    expect(saved).toEqual({ username: "test-user", password: "test-token" })
    prompt.mockClear()
    expect((await withGitAskpass(prompt, () => runCancellableGit(networkArgs, root, new AbortController().signal), credentials)).exitCode).toBe(0)
    expect(prompt).not.toHaveBeenCalled()
    expected = `Basic ${Buffer.from("test-user:changed-token").toString("base64")}`
    expect((await withGitAskpass(prompt, () => runGit(networkArgs, root), credentials)).exitCode).not.toBe(0)
    expect(rejected).toHaveBeenCalled()
    expect(saved).toBeUndefined()
    const freshPrompt = vi.fn(async (value: string) => value.startsWith("Username") ? "test-user" : "changed-token")
    expect((await withGitAskpass(freshPrompt, () => runGit(networkArgs, root), credentials)).exitCode).toBe(0)
    expect(saved?.password).toBe("changed-token")
    expect(freshPrompt).toHaveBeenCalled()
    expect(warning).not.toHaveBeenCalled()
    const cancelled = await withGitAskpass(async () => null, () => runGit(args, root))
    expect(cancelled.exitCode).not.toBe(0)
    expect(authorized).toBeGreaterThan(0)
  } finally { server.closeAllConnections(); server.close(); await rm(root, { recursive: true, force: true }) }
}, 40_000)
