import { expect, it } from "vitest"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { restoreWorkspaceTabs } from "@main/files/restore-tabs"
it("recovers uniquely moved notes, keeps existing files and refuses ambiguous matches", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-restore-"))
  try {
    await mkdir(join(root, "第三节 运算符"))
    await writeFile(join(root, "第三节 运算符", "第二十九.md"), "内容")
    await writeFile(join(root, "keep.md"), "")
    await writeFile(join(root, "same.md"), "")
    await writeFile(join(root, "第三节 运算符", "same.md"), "")
    const moved = join(root, "第二十九.md"), ambiguous = join(root, "old", "same.md"), existing = join(root, "keep.md")
    expect(await restoreWorkspaceTabs(root, [moved, ambiguous, existing])).toEqual({
      [moved]: join(root, "第三节 运算符", "第二十九.md"), [ambiguous]: null, [existing]: existing
    })
  } finally { await rm(root, { recursive: true, force: true }) }
})
