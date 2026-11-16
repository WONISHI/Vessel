import { afterEach, expect, it } from "vitest"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ClipboardHistory, clipboardTextKind } from "../../src/main/clipboard/history"

const stores: ClipboardHistory[] = []
const store = (path = ":memory:") => { const value = new ClipboardHistory(path); stores.push(value); return value }
afterEach(() => { stores.splice(0).forEach((value) => value.close()) })

it("classifies text without treating ordinary words or multiline content as links", () => {
  expect(clipboardTextKind("#a18aff")).toBe("color")
  expect(clipboardTextKind("#abcd")).toBe("color")
  expect(clipboardTextKind("rgb(30, 45, 60)")).toBe("color")
  expect(clipboardTextKind("https://example.com/path?q=中文")).toBe("link")
  for (const text of ["red", "#abcd12z", "https://a.test\nmore", "javascript:alert(1)", ":deep(.class) { color: red }"]) expect(clipboardTextKind(text)).toBe("text")
})

it("deduplicates complete payloads, preserves pins and keeps rich text for copying", () => {
  const history = store()
  const original = { kind: "text" as const, text: "hello", html: "<b>hello</b>", rtf: "{\\rtf1 hello}" }
  const first = history.add(original, 1)!
  const second = history.add({ kind: "text", text: "other" }, 2)!
  history.pin(first)
  expect(history.add(original, 3)).toBe(first)
  expect(history.list().map((value) => value.id)).toEqual([first, second])
  expect(history.list()[0].pinned).toBe(true)
  expect(history.get(first)).toMatchObject(original)
  expect(history.add({ ...original, html: "<i>hello</i>" }, 4)).not.toBe(first)
})

it("searches the full text with literal wildcard characters and combines type/pinned filters", () => {
  const history = store()
  const text = "a".repeat(7000) + " 深处的关键词 100% _literal"
  const id = history.add({ kind: "text", text })!
  history.add({ kind: "link", text: "https://example.com" })
  history.pin(id)
  expect(history.list({ query: "深处的关键词", kind: "text", pinnedOnly: true })[0].id).toBe(id)
  expect(history.list({ query: "100% _literal" })).toHaveLength(1)
  expect(history.list({ query: "_no_match" })).toHaveLength(0)
  expect(history.list({ kind: "image" })).toHaveLength(0)
  expect(history.list()[0].preview.length).toBe(6000)
  expect(history.get(id)?.text).toBe(text)
})

it("survives restart and clears only unpinned records", () => {
  const path = join(mkdtempSync(join(tmpdir(), "vessel-clipboard-store-")), "history.sqlite")
  const history = new ClipboardHistory(path)
  const pinned = history.add({ kind: "files", text: "/tmp/a.txt", files: ["/tmp/a.txt", "/tmp/b.txt"], fileFormat: "public.file-url", fileData: Buffer.from("file:///tmp/a.txt") })!
  history.pin(pinned)
  history.add({ kind: "image", text: "", image: Buffer.from([1, 2, 3]), thumbnail: "data:image/jpeg;base64,AQID" })
  history.close()
  const restored = store(path)
  expect(restored.count()).toBe(2)
  expect(restored.get(pinned)?.files).toEqual(["/tmp/a.txt", "/tmp/b.txt"])
  expect(restored.get(pinned)?.fileData).toEqual(Buffer.from("file:///tmp/a.txt"))
  restored.clear()
  expect(restored.list().map((value) => value.id)).toEqual([pinned])
  restored.remove(pinned)
  expect(restored.count()).toBe(0)
})

it("bounds history count and storage while retaining pinned entries", () => {
  const history = store()
  const pinned = history.add({ kind: "text", text: "keep" }, 0)!
  history.pin(pinned)
  for (let index = 1; index <= 205; index++) history.add({ kind: "text", text: `entry ${index}` }, index)
  expect(history.count()).toBe(200)
  expect(history.get(pinned)?.text).toBe("keep")
  expect(history.list({ query: "entry 1" }).some((entry) => entry.preview === "entry 1")).toBe(false)
  expect(history.add({ kind: "image", text: "", image: Buffer.alloc(17 * 1024 * 1024) })).toBeUndefined()
  const image = Buffer.alloc(12 * 1024 * 1024)
  for (let index = 0; index < 7; index++) history.add({ kind: "image", text: `image ${index}`, image }, 300 + index)
  expect(history.list().reduce((total, entry) => total + entry.size, 0)).toBeLessThanOrEqual(64 * 1024 * 1024)
  expect(history.get(pinned)?.text).toBe("keep")
})
