import { it, expect } from "vitest"
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { transferWorkspaceFiles } from "@main/modules/files/transfer-workspace-files"
it("moves multiple entries, deduplicates descendants, and imports without deleting external sources", async () => {
  const temp = await mkdtemp(join(tmpdir(), "vessel-drop-")),
    root = join(temp, "vault"),
    target = join(root, "target"),
    external = join(temp, "outside.txt")
  try {
    await mkdir(target, { recursive: true })
    await mkdir(join(root, "folder"))
    await writeFile(join(root, "folder", "a.txt"), "a")
    await writeFile(join(root, "b.txt"), "b")
    await writeFile(external, "outside")
    const result = await transferWorkspaceFiles(root, [join(root, "folder"), join(root, "folder", "a.txt"), join(root, "b.txt")], target, false)
    expect(result).toHaveLength(2)
    expect(await readFile(join(target, "folder", "a.txt"), "utf8")).toBe("a")
    await expect(access(join(root, "b.txt"))).rejects.toThrow()
    await transferWorkspaceFiles(root, [external], target, true)
    expect(await readFile(external, "utf8")).toBe("outside")
    expect(await readFile(join(target, "outside.txt"), "utf8")).toBe("outside")
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
it("rejects conflicts and invalid destinations before moving any entry", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-drop-")),
    target = join(root, "target")
  try {
    await mkdir(target)
    await writeFile(join(root, "a"), "a")
    await writeFile(join(root, "b"), "b")
    await writeFile(join(target, "b"), "existing")
    await expect(transferWorkspaceFiles(root, [join(root, "a"), join(root, "b")], target, false)).rejects.toThrow("已存在")
    expect(await readFile(join(root, "a"), "utf8")).toBe("a")
    expect(await readFile(join(target, "b"), "utf8")).toBe("existing")
    await expect(transferWorkspaceFiles(root, [root], target, false)).rejects.toThrow("根目录")
    await expect(transferWorkspaceFiles(root, [target], target, false)).rejects.toThrow("自身")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
