import { expect, it } from "vitest"
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { queryWorkspaceBase } from "@main/modules/bases/query-base"

it("reads actual vault notes, refreshes cached properties and rejects escaped Base paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-base-"))
  try {
    await mkdir(join(root, "notes"))
    await mkdir(join(root, ".git"))
    const file = join(root, "notes", "A.md"),
      base = join(root, "list.base")
    await writeFile(base, 'views:\n  - type: cards\n  - type: table\n    order: [file.name, 账号]\n    filters: file.ext == "md"')
    await writeFile(file, "---\n账号: first\n---\n")
    await writeFile(join(root, ".git", "hidden.md"), "---\n账号: hidden\n---")
    await symlink(file, join(root, "linked.md"))
    await mkdir(join(root, "template"))
    await writeFile(join(root, "template", "dynamic.md"), '---\n<%*\nthrow new Error("do not execute")\n%>\n状态: 模板\n---')
    const result = await queryWorkspaceBase(root, "./list.base")
    expect(result.viewIndex).toBe(1)
    expect(result.rows.filter((row) => row.path.startsWith("notes/")).map((row) => row.values["账号"])).toEqual(["first"])
    expect(result.warnings).toEqual([])
    await writeFile(file, "---\n账号: changed\n---\n")
    expect((await queryWorkspaceBase(root, base)).rows.find((row) => row.path === "notes/A.md")!.values["账号"]).toBe("changed")
    await expect(queryWorkspaceBase(join(root, "notes"), base)).rejects.toThrow("工作区")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
