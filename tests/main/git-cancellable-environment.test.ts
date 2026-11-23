import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { afterEach, expect, it, vi } from "vitest"
import { runCancellableGit } from "@main/modules/git/cancellable-git"

const setup = vi.hoisted(() => ({ environment: vi.fn() }))
vi.mock("dugite", () => ({ setupEnvironment: setup.environment }))
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

function missingEmbeddedGit() {
  setup.environment.mockImplementation((env: NodeJS.ProcessEnv) => ({
    gitLocation: "/vessel-missing-bundled-git/bin/git",
    env: { ...env, PATH: "/vessel-missing-bundled-git/bin", GIT_EXEC_PATH: "/vessel-missing-bundled-git/libexec/git-core", GIT_CONFIG_SYSTEM: "/vessel-missing-bundled-git/etc/gitconfig", GIT_TEMPLATE_DIR: "/vessel-missing-bundled-git/share/templates", GIT_SSL_CAINFO: "/vessel-missing-bundled-git/cacert.pem", PREFIX: "/vessel-missing-bundled-git" }
  }))
}

it("restores the system helper search path when bundled Git cannot start", async () => {
  missingEmbeddedGit()
  const expected = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim()
  const result = await runCancellableGit(["--exec-path"], tmpdir(), new AbortController().signal)
  expect(result.exitCode).toBe(0)
  expect(result.stdout.trim()).toBe(expected)
})

it("starts the system HTTP transport helper after fallback without making a network request", async () => {
  missingEmbeddedGit()
  const result = await runCancellableGit(["remote-http"], tmpdir(), new AbortController().signal)
  expect(result.stderr).not.toMatch(/not a git command|cannot run|No such file/)
  expect(result.stderr).toMatch(/usage: git remote-/i)
})

it("preserves explicitly configured system Git variables rather than deleting them", async () => {
  const customPath = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim()
  vi.stubEnv("GIT_EXEC_PATH", customPath)
  missingEmbeddedGit()
  const result = await runCancellableGit(["--exec-path"], tmpdir(), new AbortController().signal)
  expect(result.stdout.trim()).toBe(customPath)
})

it("does not retry a Git command that started and returned a nonzero exit code", async () => {
  setup.environment.mockImplementation((env: NodeJS.ProcessEnv) => ({ gitLocation: "git", env }))
  const result = await runCancellableGit(["vessel-command-that-does-not-exist"], tmpdir(), new AbortController().signal)
  expect(result.exitCode).not.toBe(0)
  expect(setup.environment).toHaveBeenCalledOnce()
})
