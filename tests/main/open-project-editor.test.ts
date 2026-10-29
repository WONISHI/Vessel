import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ launch: vi.fn() }))
vi.mock("node:child_process", () => ({
  execFile: (file: string, args: string[], _options: unknown, callback: Function) => {
    try { mocks.launch(file, args); callback(null, "", "") } catch (error) { callback(error, "", "") }
  }
}))
vi.mock("node:fs/promises", () => ({
  realpath: async (path: string) => path,
  stat: async () => ({ isDirectory: () => true })
}))
import { openProjectInEditor } from "@main/files/open-project-editor"
beforeEach(() => { mocks.launch.mockReset() })
it("prefers VS Code and passes the full project path as one argument", async () => {
  expect(await openProjectInEditor("/projects/项目 with spaces")).toBe("VS Code")
  expect(mocks.launch).toHaveBeenCalledTimes(1)
  expect(mocks.launch.mock.calls[0][1].at(-1)).toBe("/projects/项目 with spaces")
  if (process.platform === "darwin") expect(mocks.launch.mock.calls[0]).toEqual(["/usr/bin/open", ["-b", "com.microsoft.VSCode", "/projects/项目 with spaces"]])
})
it("falls back to WebStorm and reports when neither can be launched", async () => {
  mocks.launch.mockImplementationOnce(() => { throw new Error("not installed") })
  expect(await openProjectInEditor("/projects/demo")).toBe("WebStorm")
  expect(mocks.launch).toHaveBeenCalledTimes(2)
  mocks.launch.mockImplementation(() => { throw new Error("not installed") })
  await expect(openProjectInEditor("/projects/demo")).rejects.toThrow("请确认已安装")
  await expect(openProjectInEditor("relative")).rejects.toThrow("项目路径无效")
})
