import { mkdtemp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
import { directoryNodes } from "../../src/main/modules/welcome/directory-nodes"

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return { ...actual, stat: vi.fn(actual.stat) }
})

it("returns all names and types without per-entry stat calls, and reads timestamps only when requested", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-directory-fast-"))
  try {
    await mkdir(join(root, "src"))
    await Promise.all(Array.from({ length: 120 }, (_, i) => writeFile(join(root, `file-${i}.ts`), "")))
    const entries = await readdir(root, { withFileTypes: true })
    const quick = await directoryNodes(root, entries, false)
    expect(quick).toHaveLength(121)
    expect(quick.find(item => item.name === "src")?.type).toBe("directory")
    expect(quick.find(item => item.name === "file-0.ts")?.type).toBe("file")
    expect(stat).not.toHaveBeenCalled()
    const full = await directoryNodes(root, entries)
    expect(stat).toHaveBeenCalledTimes(121)
    expect(full).toHaveLength(121)
    expect(full[0].type).toBe("directory")
    expect(full.every(item => "mtime" in item && item.mtime > 0)).toBe(true)
    expect(new Set(full.map(item => item.path))).toEqual(new Set(quick.map(item => item.path)))
  } finally { await rm(root, { recursive: true, force: true }) }
})
