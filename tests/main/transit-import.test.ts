import { expect, it, vi } from "vitest"
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const mocks = vi.hoisted(() => ({ pick: vi.fn() }))
vi.mock("electron", () => ({ app: {}, BrowserWindow: { fromWebContents: () => ({}) }, clipboard: {}, dialog: { showOpenDialog: mocks.pick } }))
vi.mock("@main/office/office", () => ({ serveOffice: vi.fn() }))
it("imports selected local files for preview, cancels cleanly, and rejects unsupported formats", async () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>()
  const { registerTransit } = await import("@main/transit/transit")
  registerTransit({ ipc: { handle: (name: string, handler: any) => handlers.set(name, handler) } } as never)
  const directory = await realpath(await mkdtemp(join(tmpdir(), "vessel-transit-import-")))
  try {
    const file = join(directory, "测试.md")
    await writeFile(file, "# Imported")
    mocks.pick.mockResolvedValueOnce({ canceled: true })
    expect(await handlers.get("transit:import-files")!()).toEqual([])
    mocks.pick.mockResolvedValueOnce({ canceled: false, filePaths: [file] })
    expect(await handlers.get("transit:import-files")!()).toEqual([{ root: directory, path: file, title: "测试.md" }])
    expect(await handlers.get("transit:read-file")!(null, directory, file)).toEqual({ kind: "markdown", content: "# Imported" })
    const unknown = join(directory, "unknown.bin")
    await writeFile(unknown, "binary")
    mocks.pick.mockResolvedValueOnce({ canceled: false, filePaths: [unknown] })
    await expect(handlers.get("transit:import-files")!()).rejects.toThrow("不支持")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
