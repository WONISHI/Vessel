import { expect, it } from "vitest"
import { countFileNodes, getFileExtension } from "../../packages/utils/src/files"

it("counts files without counting unloaded or empty directories", () => {
  expect(countFileNodes([
    { name: "lazy", path: "/lazy", type: "directory" },
    { name: "empty", path: "/empty", children: [] },
    { name: "loaded", path: "/loaded", children: [{ name: "a.md", path: "/loaded/a.md" }] }
  ])).toBe(1)
})
it("extracts extensions from the final path segment on both platforms", () => {
  expect(getFileExtension("/a.b/README")).toBe("")
  expect(getFileExtension("C:\\notes\\FILE.MD")).toBe("md")
  expect(getFileExtension(".gitignore")).toBe("")
  expect(getFileExtension("archive.tar.gz")).toBe("gz")
})
