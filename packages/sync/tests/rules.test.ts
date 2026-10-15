import { expect, it } from "vitest"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseSyncExcludeRules, createSyncExcludeFilter, collectFiles } from "../src/index"
it("accepts both requested syntaxes and merges repeated groups", () => {
  const expected = { file: ["a", "b", "c"], folder: ["d"] }
  expect(parseSyncExcludeRules("{file:a,b,c},{folder:d}")).toEqual(expected)
  expect(parseSyncExcludeRules("{file:a,b,c;folder:d}")).toEqual(expected)
  expect(parseSyncExcludeRules(" {file:a,b}\n{file:b,c;folder:d} ")).toEqual(expected)
  expect(parseSyncExcludeRules("  ")).toEqual({ file: [], folder: [] })
})
it("keeps file and folder matching separate and supports relative paths and wildcards", () => {
  const filter = createSyncExcludeFilter("{file:a,*.log,docs/private.md;folder:d,cache*}")
  expect(filter("nested/a", "file")).toBe(true)
  expect(filter("nested/a", "folder")).toBe(false)
  expect(filter("nested/a/readme.md", "file")).toBe(false)
  expect(filter("d", "file")).toBe(false)
  expect(filter("d", "folder")).toBe(true)
  expect(filter("nested/d/photo.png", "file")).toBe(true)
  expect(filter("docs/private.md", "file")).toBe(true)
  expect(filter("other/docs/private.md", "file")).toBe(false)
  expect(filter("cache-data/file.txt", "file")).toBe(true)
  expect(filter("some/a.log", "file")).toBe(true)
})
it("rejects malformed rules instead of silently disabling exclusion", () => {
  for (const text of ["file:a", "{file:a", "{folder:}", "{file:a,,b}", "{files:a}", "{file:../a}", "{folder:/root}", "{file:a},", "{file:a;folder:d;}"]) expect(() => parseSyncExcludeRules(text)).toThrow("同步排除规则")
})
it("prunes excluded directories, keeps file-named directories and rejects selected excluded files", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-exclude-rules-"))
  try {
    await mkdir(join(root, "a")); await mkdir(join(root, "d"))
    await writeFile(join(root, "a/keep.md"), "keep"); await writeFile(join(root, "d/hidden.md"), "hidden"); await writeFile(join(root, "b"), "hidden")
    const excludePath = createSyncExcludeFilter("{file:a,b;folder:d}"), excluded: string[] = []
    expect((await collectFiles({ root, excludePath, onExcluded: path => excluded.push(path) })).map(file => file.path)).toEqual(["a/keep.md"])
    expect(excluded.sort()).toEqual(["b", "d"])
    await expect(collectFiles({ root, selected: join(root, "b"), excludePath })).rejects.toThrow("排除规则")
  } finally { await rm(root, { recursive: true, force: true }) }
})
