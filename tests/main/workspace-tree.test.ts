import { expect, it } from "vitest"
import { buildWorkspaceTree } from "../../src/renderer/src/layout/workspace-tree"
it("groups nested paths and preserves original file paths without changing source data", () => {
  const files = [
    { name: "readme.md", path: "/project/readme.md" },
    { name: "a.ts", path: "/project/src/lib/a.ts" },
    { name: "b.ts", path: "/project/src/b.ts" }
  ]
  const tree = buildWorkspaceTree(files, "/project")
  expect(tree[0].name).toBe("src")
  expect(tree[0].children?.[0].children?.[0].path).toBe("/project/src/lib/a.ts")
  expect(tree[1].name).toBe("readme.md")
  expect(files).toHaveLength(3)
})
it("supports Windows paths and empty workspaces", () => {
  expect(buildWorkspaceTree([{ name: "a.md", path: "C:\\project\\docs\\a.md" }], "C:\\project")[0].children?.[0].path).toBe("C:\\project\\docs\\a.md")
  expect(buildWorkspaceTree([], "/project")).toEqual([])
})
