import { expect, it, vi } from "vitest"
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const handlers = vi.hoisted(() => ({ handle: vi.fn(), fetch: vi.fn(async () => new Response("image")) }))
vi.mock("electron", () => ({ protocol: { handle: handlers.handle }, net: { fetch: handlers.fetch } }))
import { createImageResource, registerImageResources } from "@main/modules/files/image-resource"
it("streams only granted images and rejects replaced symlinks and unknown tokens", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-resource-"))
  try {
    const note = join(root, "note.md"), image = join(root, "a.png")
    await writeFile(note, "")
    await writeFile(image, "image")
    const url = await createImageResource(root, note, "![[a.png]]")
    expect(await createImageResource(root, note, "![[a.png]]")).toBe(url)
    expect(url).not.toContain(root)
    registerImageResources()
    const handle = handlers.handle.mock.calls[0][1]
    const response = await handle(new Request(url))
    expect(await response.text()).toBe("image")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect((await handle(new Request("vessel-image://resource/unknown"))).status).toBe(404)
    await rm(image)
    await symlink(note, image)
    expect((await handle(new Request(url))).status).toBe(403)
  } finally { await rm(root, { recursive: true, force: true }) }
})
