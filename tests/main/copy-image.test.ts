import { afterEach, expect, it, vi } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const mocks = vi.hoisted(() => ({ folder: "", writeBuffer: vi.fn(), clear: vi.fn() }))
vi.mock("electron", () => ({ app: { getPath: () => mocks.folder }, clipboard: { clear: mocks.clear, writeBuffer: mocks.writeBuffer, writeImage: vi.fn() }, nativeImage: { createFromBuffer: () => ({ isEmpty: () => true }) } }))
import { copyImage } from "../../src/main/modules/files/copy-image"
afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); if (mocks.folder) await rm(mocks.folder, { recursive: true, force: true }); mocks.writeBuffer.mockClear() })
it("copies SVG bytes as a file URL on macOS", async () => {
  vi.spyOn(process, "platform", "get").mockReturnValue("darwin")
  mocks.folder = await mkdtemp(join(tmpdir(), "vessel-copy-"))
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>中文</text></svg>'
  await copyImage("data:image/svg+xml;charset=utf-8;base64," + Buffer.from(svg).toString("base64"))
  const [format, value] = mocks.writeBuffer.mock.calls[0]
  expect(format).toBe("public.file-url")
  expect(await readFile(fileURLToPath(value.toString()), "utf8")).toBe(svg)
})
it("writes a Unicode file-drop list for Windows", async () => {
  vi.spyOn(process, "platform", "get").mockReturnValue("win32")
  mocks.folder = await mkdtemp(join(tmpdir(), "vessel-copy-"))
  await copyImage("data:image/png;base64," + Buffer.from("fixture").toString("base64"))
  const [format, value] = mocks.writeBuffer.mock.calls[0]
  expect(format).toBe("CF_HDROP")
  expect(value.readUInt32LE(0)).toBe(20)
  expect(value.readUInt32LE(16)).toBe(1)
  expect(value.subarray(20).toString("utf16le")).toMatch(/\.png\0\0$/)
})
it("rejects non-image sources before modifying clipboard", async () => {
  mocks.clear.mockClear()
  await expect(copyImage("file:///etc/passwd")).rejects.toThrow()
  expect(mocks.clear).not.toHaveBeenCalled()
})
