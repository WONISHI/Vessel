import { expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>(), events: new Map<string, (...args: any[]) => any>(), send: vi.fn() }))
vi.mock("electron", () => ({
  app: { isPackaged: true, on: (event: string, callback: (...args: any[]) => any) => mocks.events.set(event, callback) },
  BrowserWindow: { fromWebContents: (sender: any) => ({ isMinimized: () => false, show: vi.fn(), focus: vi.fn(), webContents: sender }), getAllWindows: () => [{ isMinimized: () => false, show: vi.fn(), focus: vi.fn(), webContents: { send: mocks.send } }] },
  ipcMain: { handle: (event: string, callback: (...args: any[]) => any) => mocks.handlers.set(event, callback) }
}))
vi.mock("node:fs/promises", () => ({ stat: vi.fn(async () => ({ isFile: () => true })) }))
import { markdownArguments, registerMarkdownOpening } from "../../src/main/open-markdown"
it("accepts Markdown file arguments with spaces and resolves against the launcher cwd", () => {
  expect(markdownArguments(["vessel.exe", "--inspect", "笔记 文档.MD", "readme.markdown", "photo.png"], "/notes")).toEqual(["/notes/笔记 文档.MD", "/notes/readme.markdown", "/notes/photo.png"])
})
it("queues files until the renderer is ready and then delivers second-instance requests", async () => {
  const args = process.argv
  process.argv = ["vessel.exe"]
  registerMarkdownOpening()
  process.argv = args
  const preventDefault = vi.fn()
  mocks.events.get("open-file")!({ preventDefault }, "/notes/first.md")
  await vi.waitFor(() => expect(preventDefault).toHaveBeenCalled())
  expect(mocks.handlers.get("markdown:pending")!()).toEqual(["/notes/first.md"])
  mocks.events.get("second-instance")!({}, ["vessel.exe", "第二篇.md"], "/notes")
  await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledWith("markdown:open", "/notes/第二篇.md"))
})

it("keeps file delivery ready across subframe loads and queues only real main-frame reloads", async () => {
  const events = new Map<string, Function>()
  const sender = { send: vi.fn(), isDestroyed: () => false, on: (name: string, fn: Function) => events.set(name, fn), once: vi.fn() }
  mocks.handlers.get("markdown:pending")!({ sender })
  events.get("did-start-navigation")!({}, "http://localhost/office.html", false, false)
  mocks.events.get("open-file")!({ preventDefault() {} }, "/notes/live.pdf")
  await vi.waitFor(() => expect(sender.send).toHaveBeenCalledWith("markdown:open", "/notes/live.pdf"))
  events.get("did-start-navigation")!({}, "file:///index.html", false, true)
  mocks.events.get("open-file")!({ preventDefault() {} }, "/notes/reload.pdf")
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(sender.send).not.toHaveBeenCalledWith("markdown:open", "/notes/reload.pdf")
  expect(mocks.handlers.get("markdown:pending")!({ sender })).toEqual(["/notes/reload.pdf"])
})
