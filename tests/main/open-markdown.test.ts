import { expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>(), events: new Map<string, (...args: any[]) => any>(), send: vi.fn() }))
vi.mock("electron", () => ({
  app: { on: (event: string, callback: (...args: any[]) => any) => mocks.events.set(event, callback) },
  BrowserWindow: { getAllWindows: () => [{ isMinimized: () => false, show: vi.fn(), focus: vi.fn(), webContents: { send: mocks.send } }] },
  ipcMain: { handle: (event: string, callback: (...args: any[]) => any) => mocks.handlers.set(event, callback) }
}))
vi.mock("node:fs/promises", () => ({ stat: vi.fn(async () => ({ isFile: () => true })) }))
import { markdownArguments, registerMarkdownOpening } from "../../src/main/open-markdown"
it("accepts Markdown file arguments with spaces and resolves against the launcher cwd", () => {
  expect(markdownArguments(["vessel.exe", "--inspect", "笔记 文档.MD", "readme.markdown", "photo.png"], "/notes")).toEqual(["/notes/笔记 文档.MD", "/notes/readme.markdown"])
})
it("queues files until the renderer is ready and then delivers second-instance requests", async () => {
  registerMarkdownOpening()
  const preventDefault = vi.fn()
  mocks.events.get("open-file")!({ preventDefault }, "/notes/first.md")
  await vi.waitFor(() => expect(preventDefault).toHaveBeenCalled())
  expect(mocks.handlers.get("markdown:pending")!()).toEqual(["/notes/first.md"])
  mocks.events.get("second-instance")!({}, ["vessel.exe", "第二篇.md"], "/notes")
  await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledWith("markdown:open", "/notes/第二篇.md"))
})
