import { expect, it } from "vitest"
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readWikiLink } from "../../src/main/modules/files/wiki-link"
it("reads root-relative notes but rejects traversal and symlink escapes", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "vessel-wiki-"))
  try {
    const root = join(temporary, "vault")
    await mkdir(join(root, "notes"), { recursive: true })
    await writeFile(join(root, "notes/a.md"), "# Note\ncontent")
    expect((await readWikiLink(root, "notes/a")).content).toContain("# Note")
    await writeFile(join(temporary, "secret.md"), "secret")
    await symlink(join(temporary, "secret.md"), join(root, "outside.md"))
    await expect(readWikiLink(root, "../secret.md")).rejects.toThrow()
    await expect(readWikiLink(root, "outside.md")).rejects.toThrow()
    await expect(readWikiLink(root, "missing")).rejects.toThrow()
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
