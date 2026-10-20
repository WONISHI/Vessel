import { it, expect, vi } from "vitest"
import { mkdtemp, realpath, writeFile, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), partition: vi.fn() }))
vi.mock("electron", () => ({
  nativeImage: { createFromBuffer: (data: Buffer) => ({ isEmpty: () => !data.length, toPNG: () => data }) },
  session: {
    fromPartition: (name: string) => {
      mocks.partition(name)
      return { fetch: mocks.fetch }
    }
  }
}))
import { saveObsidianImage } from "@main/modules/files/save-obsidian-image"
it("writes root attachments with timestamp names, preserves collisions and validates the document", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-paste-"))
  const doc = join(root, "note.md")
  try {
    await writeFile(doc, "")
    const first = await saveObsidianImage(root, doc, { bytes: new Uint8Array([1, 2]) })
    const second = await saveObsidianImage(root, doc, { bytes: new Uint8Array([3, 4]) })
    expect(first.name).toMatch(/^Pasted image \d{14}\.png$/)
    expect(first.path).toBe(join(await realpath(root), first.name))
    expect(first.reference).toBe(`![[${first.name}]]`)
    expect(second.name).not.toBe(first.name)
    expect(await readFile(first.path)).toEqual(Buffer.from([1, 2]))
    await expect(saveObsidianImage(root, root, { bytes: new Uint8Array([1]) })).rejects.toThrow("文档不在工作区")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
it("downloads through browser session and rejects non-images without creating files", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-download-"))
  const doc = join(root, "note.md")
  try {
    await writeFile(doc, "")
    mocks.fetch.mockResolvedValueOnce(new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))
    const saved = await saveObsidianImage(root, doc, { url: "https://example.com/img?format=svg" })
    expect(saved.name).toMatch(/\.svg$/)
    expect(mocks.partition).toHaveBeenCalledWith("persist:vessel-browser")
    const before = await readdir(root)
    mocks.fetch.mockResolvedValueOnce(new Response("<html>login</html>"))
    await expect(saveObsidianImage(root, doc, { url: "https://example.com/login" })).rejects.toThrow("不是支持的图片")
    expect(await readdir(root)).toEqual(before)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it("downloads webp image with non-ASCII size bytes in RIFF header", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-download-webp-"))
  const doc = join(root, "note.md")
  try {
    await writeFile(doc, "")
    // RIFF + 0xc6 0xa8 0x00 0x00 + WEBP + VP8X
    const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0xc6, 0xa8, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58])
    mocks.fetch.mockResolvedValueOnce(new Response(webpBuffer, { headers: { "content-type": "image/webp" } }))
    const saved = await saveObsidianImage(root, doc, { url: "https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/03e58c7c4f9b47299f705ee8c13b363d~tplv-k3u1fbpfcp-jj-mark:3024:0:0:0:q75.awebp" })
    expect(saved.name).toMatch(/\.webp$/)
    expect(await readFile(saved.path)).toEqual(webpBuffer)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it("reuses vault images and imports external files without overwriting same-name attachments", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-image-vault-"))
  const external = await mkdtemp(join(tmpdir(), "vessel-image-outside-"))
  try {
    const doc = join(root, "note.md"), inside = join(root, "photo.png"), outside = join(external, "photo.png")
    await writeFile(doc, "")
    await writeFile(inside, "existing image")
    await writeFile(outside, "external image")
    const reused = await saveObsidianImage(root, doc, { path: inside })
    expect(reused.reference).toBe("![[photo.png]]")
    expect((await readdir(root)).sort()).toEqual(["note.md", "photo.png"])
    const imported = await saveObsidianImage(root, doc, { path: outside })
    expect(imported.reference).toBe("![[photo (1).png]]")
    expect(await readFile(imported.path, "utf8")).toBe("external image")
    expect(await readFile(inside, "utf8")).toBe("existing image")
    expect(await readFile(outside, "utf8")).toBe("external image")
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(external, { recursive: true, force: true })
  }
})
