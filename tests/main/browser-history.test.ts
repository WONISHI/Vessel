import { expect, it } from "vitest"
import { BrowserHistory } from "@main/browser/browser-history"
it("keeps only 30 days, preserves visits and deletes chosen records", () => {
  const history = new BrowserHistory(":memory:")
  const now = Date.now()
  history.add("https://old.test", "old", now - 31 * 86400000)
  const id = history.add("https://current.test", "current", now)!
  history.add("file:///secret", "not a website")
  expect(history.list()).toHaveLength(1)
  history.title(id, "new title")
  expect(history.list()[0].title).toBe("new title")
  history.favicon(id, "https://current.test/icon.png")
  expect(history.list()[0].favicon).toBe("https://current.test/icon.png")
  history.favicon(id, "file:///secret")
  expect(history.list()[0].favicon).toBe("https://current.test/icon.png")
  history.delete(id)
  expect(history.list()).toEqual([])
  history.add("https://current.test", "current")
  history.delete(null)
  expect(history.list()).toEqual([])
  history.close()
})
it("omits tracking redirects and coalesces quick duplicate navigations while keeping later visits", () => {
  const history = new BrowserHistory(":memory:")
  const now = Date.now()
  expect(history.add("https://www.bing.com/ck/a?tracking=1", "redirect", now)).toBeUndefined()
  const first = history.add("https://uviewui.com/components/intro", "介绍", now)
  expect(history.add("https://uviewui.com/components/intro.html", "介绍", now + 1000)).toBe(first)
  expect(history.add("https://uviewui.com/components/intro.html#section", "介绍", now + 2000)).toBe(first)
  expect(history.list()).toHaveLength(1)
  history.add("https://uviewui.com/components/intro.html", "介绍", now + 120000)
  expect(history.list()).toHaveLength(2)
  history.close()
})
it("stores bookmarks without fabricating visits and preserves bookmarks when clearing history", () => {
  const history = new BrowserHistory(":memory:")
  history.setBookmarks([{ url: "https://saved.test/", title: "Saved" }])
  expect(history.list()).toEqual([])
  history.add("https://saved.test/", "Saved")
  expect(history.list()[0].bookmarked).toBe(1)
  history.delete(null)
  history.add("https://saved.test/", "Saved again")
  expect(history.list()[0].bookmarked).toBe(1)
  history.setBookmarks([])
  expect(history.list()[0].bookmarked).toBe(0)
  history.close()
})

it("persists download records independently from browsing history", () => {
  const history = new BrowserHistory(":memory:")
  try {
    history.addDownload("/tmp/photo.png", "photo.png", 1234, "download", 100)
    history.addDownload("/tmp/archive.zip", "archive.zip", 5678, "save", 200)
    const entries = history.listDownloads()
    expect(entries.map(entry => entry.name)).toEqual(["archive.zip", "photo.png"])
    expect(history.getDownload(entries[1].id)).toMatchObject({ path: "/tmp/photo.png", size: 1234, source: "download" })
    history.delete(null)
    expect(history.listDownloads()).toHaveLength(2)
    expect(history.getDownload(-1)).toBeUndefined()
  } finally { history.close() }
})

it("retains download history after reopening the database", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const directory = await mkdtemp(join(tmpdir(), "vessel-download-history-"))
  try {
    const path = join(directory, "browser.sqlite")
    const first = new BrowserHistory(path)
    first.addDownload("/tmp/saved.pdf", "saved.pdf", 321, "download")
    first.close()
    const restored = new BrowserHistory(path)
    try { expect(restored.listDownloads()).toEqual([expect.objectContaining({ name: "saved.pdf", path: "/tmp/saved.pdf", size: 321 })]) }
    finally { restored.close() }
  } finally { await rm(directory, { recursive: true, force: true }) }
})
