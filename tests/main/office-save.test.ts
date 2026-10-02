import { expect, it, vi } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const mocks = vi.hoisted(() => ({ dialog: vi.fn(), open: vi.fn() }))
vi.mock("electron", () => ({ app: {}, BrowserWindow: { fromWebContents: () => ({}) }, dialog: { showSaveDialog: mocks.dialog, showOpenDialog: mocks.open } }))
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

it("opens a document with a native picker, saves to its original path, and renames without replacing another file", async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
  const { registerOffice } = await import("../../src/main/office")
  registerOffice({ ipc: { handle: (name: string, callback: (...args: unknown[]) => Promise<unknown>) => handlers.set(name, callback) } } as never)
  const directory = await mkdtemp(join(tmpdir(), "vessel-office-original-"))
  const { writeFile } = await import("node:fs/promises")
  try {
    const path = join(directory, "original.docx")
    await writeFile(path, new Uint8Array([80,75,1]))
    mocks.open.mockResolvedValueOnce({ canceled: false, filePaths: [path] })
    const picked = await handlers.get("office:pick")!(null) as { token: string; name: string; bytes: Uint8Array }
    expect(picked.name).toBe("original.docx")
    const calls = mocks.dialog.mock.calls.length
    expect(await handlers.get("office:commit")!(null, picked.name, new Uint8Array([80,75,2]), picked.token)).toMatchObject({ saved: true, token: picked.token })
    expect(mocks.dialog.mock.calls.length).toBe(calls)
    expect(await readFile(path)).toEqual(Buffer.from([80,75,2]))
    await handlers.get("office:rename")!(null, picked.token, "renamed.docx")
    expect(await readFile(join(directory, "renamed.docx"))).toEqual(Buffer.from([80,75,2]))
    await writeFile(join(directory, "existing.docx"), "untouched")
    await expect(handlers.get("office:rename")!(null, picked.token, "existing.docx")).rejects.toThrow("同名")
    await expect(handlers.get("office:commit")!(null, "bad.docx", new Uint8Array(), "invalid-token")).rejects.toThrow("授权")
  } finally { await rm(directory, { recursive: true, force: true }) }
})
