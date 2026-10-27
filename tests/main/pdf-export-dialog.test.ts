import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ handle: vi.fn(), save: vi.fn(), load: vi.fn().mockResolvedValue(undefined), print: vi.fn(), write: vi.fn().mockResolvedValue(undefined), destroy: vi.fn(), windows: vi.fn() }))
vi.mock("electron", () => ({
  ipcMain: { handle: mocks.handle },
  dialog: { showSaveDialog: mocks.save },
  BrowserWindow: class {
    static fromWebContents() {
      return {}
    }
    webContents = { setWindowOpenHandler: vi.fn(), printToPDF: mocks.print }
    constructor() {
      mocks.windows()
    }
    loadURL = mocks.load
    destroy = mocks.destroy
  }
}))
vi.mock("node:fs/promises", () => ({ writeFile: mocks.write }))
import { installFileMenuDialog } from "@main/menu/file-dialog"
const request = { action: "pdf", html: "<html><head></head><body>中文文档</body></html>", defaultPath: "/tmp/note.pdf", pdfOptions: { paper: "A4", landscape: true, marginMm: 18, fontSize: 14, pageNumbers: true, printBackground: true } }
beforeEach(() => {
  vi.clearAllMocks()
  installFileMenuDialog()
})
const invoke = () => mocks.handle.mock.calls[0][1]({ sender: {} }, request)
it("sends configured HTML to Chromium and saves its PDF buffer", async () => {
  mocks.save.mockResolvedValue({ canceled: false, filePath: "/tmp/note.pdf" })
  const buffer = Buffer.from("pdf bytes")
  mocks.print.mockResolvedValue(buffer)
  expect(await invoke()).toBe("/tmp/note.pdf")
  expect(decodeURIComponent(mocks.load.mock.calls[0][0])).toContain("A4 landscape")
  expect(mocks.print).toHaveBeenCalledWith(expect.objectContaining({ landscape: true, pageSize: "A4", displayHeaderFooter: true }))
  expect(mocks.write).toHaveBeenCalledWith("/tmp/note.pdf", buffer)
  expect(mocks.destroy).toHaveBeenCalledOnce()
})
it("does not create a print window or write on destination cancellation", async () => {
  mocks.save.mockResolvedValue({ canceled: true })
  expect(await invoke()).toBeNull()
  expect(mocks.windows).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
})
it("destroys the hidden window after a printing failure and does not save a partial PDF", async () => {
  mocks.save.mockResolvedValue({ canceled: false, filePath: "/tmp/note.pdf" })
  mocks.print.mockRejectedValue(new Error("print failed"))
  await expect(invoke()).rejects.toThrow("print failed")
  expect(mocks.destroy).toHaveBeenCalledOnce()
  expect(mocks.write).not.toHaveBeenCalled()
})
