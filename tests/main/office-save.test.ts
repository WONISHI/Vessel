import { expect, it, vi } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const mocks = vi.hoisted(() => ({ dialog: vi.fn() }))
vi.mock("electron", () => ({ app: {}, BrowserWindow: { fromWebContents: () => ({}) }, dialog: { showSaveDialog: mocks.dialog } }))
it("writes Office bytes only to the user's selected path and respects cancellation", async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
  const { registerOffice } = await import("../../src/main/office")
  registerOffice({ ipc: { handle: (name: string, callback: (...args: unknown[]) => Promise<unknown>) => handlers.set(name, callback) } } as never)
  const directory = await mkdtemp(join(tmpdir(), "vessel-office-save-"))
  try {
    const save = handlers.get("office:save")!
    mocks.dialog.mockResolvedValueOnce({ canceled: true })
    expect(await save(null, "test.docx", new Uint8Array([80,75]))).toBe(false)
    const target = join(directory, "selected.docx")
    mocks.dialog.mockResolvedValueOnce({ canceled: false, filePath: target })
    expect(await save(null, "../../test.docx", new Uint8Array([80,75,3,4]))).toBe(true)
    expect(await readFile(target)).toEqual(Buffer.from([80,75,3,4]))
    expect(mocks.dialog.mock.calls[1][1].defaultPath).toBe("test.docx")
    await expect(save(null, "bad.docx", "not bytes")).rejects.toThrow("数据无效")
  } finally { await rm(directory, { recursive: true, force: true }) }
})
