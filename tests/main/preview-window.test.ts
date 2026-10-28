import { expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ windows: [] as any[], office: vi.fn(), transit: vi.fn() }))
vi.mock("@main/office/office", () => ({ registerOffice: mocks.office }))
vi.mock("@main/transit/transit", () => ({ registerTransit: mocks.transit }))
vi.mock("electron", () => ({
  app: { whenReady: async () => {} },
  BrowserWindow: class {
    events = new Map(); handlers = new Map(); options: any
    webContents = { send: vi.fn(), ipc: { handle: (key: string, fn: Function) => this.handlers.set(key, fn) }, setWindowOpenHandler: vi.fn(), on: vi.fn() }
    setTitle = vi.fn(); show = vi.fn(); focus = vi.fn(); restore = vi.fn(); close = vi.fn(); destroy = vi.fn()
    maximize = vi.fn(); unmaximize = vi.fn(); minimize = vi.fn()
    isDestroyed = () => false; isMinimized = () => false; isMaximized = () => false
    loadFile = vi.fn(async () => {}); loadURL = vi.fn(async () => {})
    on(key: string, fn: Function) { this.events.set(key, fn) }
    once(key: string, fn: Function) { this.events.set(key, fn) }
    constructor(options: any) { this.options = options; mocks.windows.push(this) }
  }
}))
import { openFilePreviewWindow, usesPreviewWindow } from "@main/files/preview-window"
it("loads an independent native-frame preview, supplies its file, and reuses the same file window", async () => {
  await openFilePreviewWindow("/notes/中文.pdf")
  const win = mocks.windows[0]
  expect(win.options).toMatchObject({ frame: true, show: false, webPreferences: { sandbox: true, contextIsolation: true } })
  expect(mocks.office).toHaveBeenCalledWith(win.webContents)
  expect(mocks.transit).toHaveBeenCalledWith(win.webContents)
  expect(win.handlers.get("preview:data")()).toMatchObject({ root: "/notes", content: "/notes/中文.pdf", title: "中文.pdf" })
  await openFilePreviewWindow("/notes/中文.pdf")
  expect(mocks.windows).toHaveLength(1)
  expect(win.focus).toHaveBeenCalled()
  await openFilePreviewWindow("/notes/其他.md")
  expect(mocks.windows).toHaveLength(1)
  expect(win.handlers.get("preview:tabs")()).toHaveLength(2)
  expect(win.webContents.send).toHaveBeenLastCalledWith("preview:updated", expect.objectContaining({ selected: "/notes/其他.md" }))
  await openFilePreviewWindow("/notes/中文.pdf")
  expect(win.handlers.get("preview:tabs")()).toHaveLength(2)
  expect(win.handlers.get("preview:data")().id).toBe("/notes/中文.pdf")
  win.handlers.get("preview:action")({}, "close")
  expect(win.close).toHaveBeenCalled()
  expect(usesPreviewWindow("/notes/IMAGE.AVIF")).toBe(true)
  expect(usesPreviewWindow("/notes/code.ts")).toBe(false)
})
