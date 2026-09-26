import { afterEach, expect, it, vi } from "vitest"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
vi.mock("electron", () => ({ ipcMain: { handle: vi.fn(), removeHandler: vi.fn() } }))
import { ipcMain } from "electron"
import { FilesModule, readTextFileContent } from "../../src/main/modules/files/index.module"
const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
  vi.clearAllMocks()
})
it("reads UTF-8 content and rejects invalid, missing and directory paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vessel-files-"))
  directories.push(directory)
  const path = join(directory, "中文.md")
  await writeFile(path, "# 标题\n\n内容 😀", "utf8")
  await expect(readTextFileContent(path)).resolves.toBe("# 标题\n\n内容 😀")
  await expect(readTextFileContent("relative.md")).rejects.toThrow("绝对路径")
  await expect(readTextFileContent(directory)).rejects.toThrow("普通文件")
  await expect(readTextFileContent(join(directory, "missing.md"))).rejects.toThrow()
})
it("registers the reader once and removes it on disposal", () => {
  const module = new FilesModule()
  module.activate()
  module.activate()
  expect(ipcMain.handle).toHaveBeenCalledTimes(1)
  expect(ipcMain.handle).toHaveBeenCalledWith("file:readContent", expect.any(Function))
  module.dispose()
  expect(ipcMain.removeHandler).toHaveBeenCalledWith("file:readContent")
})
