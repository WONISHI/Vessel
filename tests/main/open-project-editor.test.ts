import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ launch: vi.fn() }))
vi.mock("node:child_process", () => ({
  execFile: (file: string, args: string[], _options: unknown, callback: Function) => {
    try { mocks.launch(file, args); callback(null, "", "") } catch (error) { callback(error, "", "") }
  }
}))
vi.mock("node:fs/promises", () => ({
  realpath: async (path: string) => path,
  stat: async () => ({ isDirectory: () => true, isFile: () => true })
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

it("opens the project together with the exact file and prefers VS Code", async () => {
  expect(await openProjectInEditor("/projects/项目 with spaces", "src/a file.ts")).toBe("VS Code")
  const args = mocks.launch.mock.calls[0][1]
  expect(args.slice(-4)).toEqual(["--new-window", "/projects/项目 with spaces", "--goto", "/projects/项目 with spaces/src/a file.ts"])
  expect(mocks.launch).toHaveBeenCalledTimes(1)
})
it("passes both project and file to the WebStorm fallback", async () => {
  mocks.launch.mockImplementationOnce(() => { throw new Error("not installed") })
  expect(await openProjectInEditor("/projects/demo", "src/a.ts")).toBe("WebStorm")
  expect(mocks.launch.mock.calls[1][1].slice(-2)).toEqual(["/projects/demo", "/projects/demo/src/a.ts"])
})
it("rejects files outside the project and invalid file input before launching", async () => {
  await expect(openProjectInEditor("/projects/demo", "../other/file.ts")).rejects.toThrow("文件不在项目目录内")
  await expect(openProjectInEditor("/projects/demo", "/outside/file.ts")).rejects.toThrow("文件不在项目目录内")
  await expect(openProjectInEditor("/projects/demo", "")).rejects.toThrow("文件路径无效")
  expect(mocks.launch).not.toHaveBeenCalled()
})
