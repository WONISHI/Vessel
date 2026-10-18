vi.mock("@main/settings/settings", () => ({ generalSettings: () => ({ ignoredFiles: "", externalPreview: true }), parseIgnoredPatterns: () => [] }))
import { afterEach, expect, it, vi } from "vitest"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
vi.mock("electron", () => ({ BrowserWindow: {}, dialog: {} }))
import { searchContent } from "@main/files/content-search"
const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "vessel-search-"))
  directories.push(root)
  await mkdir(join(root, ".git"))
  await writeFile(join(root, ".gitignore"), "ignored.txt\n")
  await writeFile(join(root, "code.ts"), "前缀 needle\nNEEDLE word\na.b axb\n")
  await writeFile(join(root, "ignored.txt"), "needle")
  await writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2, 110, 101, 101, 100, 108, 101]))
  await writeFile(join(root, ".hidden.md"), "needle")
  return root
}
it("searches text recursively, honors ignores, and translates UTF-8 byte offsets to editor columns", async () => {
  const root = await fixture()
  const result = await searchContent({ root, query: "needle" })
  expect(result.matches.map((match) => match.relativePath)).not.toContain("ignored.txt")
  expect(result.matches.map((match) => match.relativePath)).toContain(".hidden.md")
  const match = result.matches.find((match) => match.relativePath === "code.ts" && match.line === 1)!
  expect(match.column).toBe(4)
  expect(match.ranges).toEqual([{ start: 3, end: 9 }])
  expect(result.matches.some((match) => match.relativePath === "binary.bin")).toBe(false)
  expect((await searchContent({ root, query: "needle", includeIgnored: true })).matches.some((match) => match.relativePath === "ignored.txt")).toBe(true)
})
it("supports filters, literal and regex matching, case sensitivity, invalid regex and cancellation", async () => {
  const root = await fixture()
  expect((await searchContent({ root, query: "needle", caseSensitive: true, include: "*.ts" })).matches).toHaveLength(1)
  expect((await searchContent({ root, query: "a.b", include: "*.ts" })).matches[0].ranges).toHaveLength(1)
  expect((await searchContent({ root, query: "a.b", regex: true, include: "*.ts" })).matches).toHaveLength(2)
  expect((await searchContent({ root, query: "needle", exclude: "*.ts,*.md" })).matches).toHaveLength(0)
  await expect(searchContent({ root, query: "[", regex: true })).rejects.toThrow()
  const controller = new AbortController()
  controller.abort()
  await expect(searchContent({ root, query: "needle" }, controller.signal)).rejects.toThrow("取消")
})
it("bounds large result sets and reports truncation", async () => {
  const root = await fixture()
  await writeFile(join(root, "large.txt"), "match\n".repeat(2100))
  const result = await searchContent({ root, query: "match" })
  expect(result.matches).toHaveLength(2000)
  expect(result.truncated).toBe(true)
})

it("returns every occurrence on a long line with its own preview and real editor column", async () => {
  const root = await fixture()
  const text = "前".repeat(350) + "关键词" + "x".repeat(3000) + "关键词"
  await writeFile(join(root, "long.txt"), text)
  const result = await searchContent({ root, query: "关键词", include: "long.txt" })
  expect(result.matches).toHaveLength(2)
  expect(result.matches.map((match) => match.column)).toEqual([351, 3354])
  for (const match of result.matches) {
    const range = match.ranges[0]
    expect(match.text.slice(range.start, range.end)).toBe("关键词")
    expect(match.text.length).toBeLessThanOrEqual(363)
  }
})
