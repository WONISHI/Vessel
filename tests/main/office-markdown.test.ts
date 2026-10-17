import { expect, it, vi } from "vitest"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const mocks = vi.hoisted(() => ({ convert: vi.fn(), pick: vi.fn() }))
vi.mock("electron", () => ({ app: {}, BrowserWindow: { fromWebContents: () => ({}) }, dialog: { showOpenDialog: mocks.pick } }))
vi.mock("@main/office/markdown", async (original) => ({ ...(await original<object>()), convertOfficeMarkdown: mocks.convert }))

it("converts before opening the folder picker, respects cancel, and preserves existing Markdown", async () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>()
  const { registerOffice } = await import("@main/office/office")
  registerOffice({ ipc: { handle: (name: string, callback: any) => handlers.set(name, callback) } } as never)
  const convert = handlers.get("office:convert-markdown")!
  const directory = await mkdtemp(join(tmpdir(), "vessel-md-test-"))
  try {
    mocks.convert.mockRejectedValueOnce(new Error("conversion failed"))
    await expect(convert(null, "test.docx", new Uint8Array([1]))).rejects.toThrow("conversion failed")
    expect(mocks.pick).not.toHaveBeenCalled()
    mocks.convert.mockResolvedValue("# Converted\n")
    mocks.pick.mockResolvedValueOnce({ canceled: true })
    expect(await convert(null, "test.docx", new Uint8Array([2]))).toEqual({ saved: false })
    await writeFile(join(directory, "test.md"), "original")
    mocks.pick.mockResolvedValueOnce({ canceled: false, filePaths: [directory] })
    expect(await convert(null, "test.docx", new Uint8Array([3]))).toEqual({ saved: true, path: join(directory, "test-1.md") })
    expect(await readFile(join(directory, "test.md"), "utf8")).toBe("original")
    expect(await readFile(join(directory, "test-1.md"), "utf8")).toBe("# Converted\n")
    expect(mocks.convert).toHaveBeenLastCalledWith("test.docx", new Uint8Array([3]))
    await expect(convert(null, "../bad.docx", new Uint8Array())).rejects.toThrow("名称")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
