import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
import { registerTransit } from "../../src/main/transit/transit"

const mock = vi.hoisted(() => ({ directory: "", empty: false }))
vi.mock("electron", () => ({
  app: { getPath: () => mock.directory }, BrowserWindow: {}, clipboard: {}, dialog: {},
  nativeImage: { createFromDataURL: () => ({ isEmpty: () => mock.empty, toPNG: () => Buffer.from("png bytes") }) }
}))

it("stores imported image bytes in the transit cache and rejects invalid input", async () => {
  mock.directory = await mkdtemp(join(tmpdir(), "vessel-transit-images-"))
  const handlers = new Map<string, (...args: any[]) => any>()
  registerTransit({ ipc: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) } } as any)
  const importImage = handlers.get("transit:import-image")!
  try {
    await expect(importImage({}, "https://example.com/image.png")).rejects.toThrow("图片内容无效")
    mock.empty = true
    await expect(importImage({}, "data:image/png;base64,broken")).rejects.toThrow("无法读取图片")
    mock.empty = false
    const file = await importImage({}, "data:image/png;base64,AAAA", "说明图片")
    expect(file.root).toBe(join(mock.directory, "transit-images"))
    expect(file.title).toBe("说明图片")
    expect(await readFile(file.path, "utf8")).toBe("png bytes")
    const another = await importImage({}, "data:image/png;base64,AAAA")
    expect(another.path).not.toBe(file.path)
    expect(await readdir(mock.directory)).toEqual(["transit-images"])
  } finally { await rm(mock.directory, { recursive: true, force: true }) }
})
