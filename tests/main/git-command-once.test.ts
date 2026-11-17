import { expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ exec: vi.fn(), spawn: vi.fn() }))
vi.mock("dugite", () => ({ exec: mock.exec }))
vi.mock("node:child_process", () => ({ spawn: mock.spawn }))
import { runGit } from "@main/modules/git/git-service"
it("returns a failed Git result without repeating a potentially partial mutation", async () => {
  mock.exec.mockResolvedValue({ exitCode: 1, stdout: "CONFLICT (content): Merge conflict in file.md", stderr: "" })
  expect(await runGit(["stash", "apply", "abc123"], "/repo")).toMatchObject({ exitCode: 1 })
  expect(mock.exec).toHaveBeenCalledTimes(1)
  expect(mock.spawn).not.toHaveBeenCalled()
})
