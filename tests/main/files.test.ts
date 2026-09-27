import { afterEach, expect, it, vi } from "vitest"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
vi.mock("electron", () => ({ ipcMain: { handle: vi.fn(), removeHandler: vi.fn() } }))
import { ipcMain } from "electron"
import { FilesModule, readTextFileContent, createWorkspaceEntry, mutateWorkspaceFile } from "../../src/main/modules/files/index.module"
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
  expect(ipcMain.handle).toHaveBeenCalledTimes(5)
  expect(ipcMain.handle).toHaveBeenCalledWith("file:readContent", expect.any(Function))
  module.dispose()
  expect(ipcMain.removeHandler).toHaveBeenCalledWith("file:readContent")
})

it("creates entries within the workspace without overwriting existing files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vessel-create-"))
  directories.push(directory)
  const folder = await createWorkspaceEntry(directory, directory, "notes", "directory")
  const file = await createWorkspaceEntry(directory, folder.path, "note.md", "file")
  expect(await readTextFileContent(file.path)).toBe("")
  await expect(createWorkspaceEntry(directory, folder.path, "note.md", "file")).rejects.toThrow()
  await expect(createWorkspaceEntry(directory, directory, "../escape", "file")).rejects.toThrow()
  await expect(createWorkspaceEntry(folder.path, directory, "escape.md", "file")).rejects.toThrow()
})

it("renames a file without overwriting a destination or escaping the workspace", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vessel-rename-"))
  directories.push(directory)
  const source = join(directory, "source.md")
  await writeFile(source, "content")
  await writeFile(join(directory, "exists.md"), "keep")
  await expect(mutateWorkspaceFile(directory, source, "exists.md")).rejects.toThrow()
  const next = await mutateWorkspaceFile(directory, source, "renamed.md")
  expect(await readTextFileContent(next)).toBe("content")
  await expect(readTextFileContent(source)).rejects.toThrow()
  await expect(mutateWorkspaceFile(directory, next, "../escape")).rejects.toThrow()
})
