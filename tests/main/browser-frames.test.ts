import { expect, it, vi } from "vitest"
import type { WebContents, WebFrameMain } from "electron"
import { readBrowserFrames, registerFrameContextMenu } from "../../src/main/browser/browser-frames"
import { EventEmitter } from "node:events"

function fixture() {
  const root = { frameTreeNodeId: 1, url: "https://example.test/", parent: null, executeJavaScript: vi.fn().mockResolvedValue({ total: 2, items: [
    { src: "/one", resolvedSrc: "https://example.test/one", name: "one" },
    { src: "https://cross.test/", resolvedSrc: "https://cross.test/" }
  ] }) }
  const cross = { frameTreeNodeId: 2, url: "https://cross.test/", parent: root, executeJavaScript: vi.fn().mockResolvedValue({ total: 1, items: [{ src: "/nested", resolvedSrc: "https://cross.test/nested" }] }) }
  const frames = [root, cross]
  const target = { getURL: () => root.url, mainFrame: Object.assign(root, { framesInSubtree: frames }), isDestroyed: () => false } as unknown as WebContents
  return { target, cross, root }
}
it("enumerates each document, preserving raw src and nested cross-origin iframe details", async () => {
  const { target, cross } = fixture()
  const snapshot = await readBrowserFrames(target)
  expect(snapshot.total).toBe(3)
  expect(snapshot.items[0]).toMatchObject({ src: "/one", depth: 0, name: "one" })
  expect(snapshot.items[2]).toMatchObject({ id: "2:0", src: "/nested", documentURL: "https://cross.test/", depth: 1 })
  expect(cross.executeJavaScript).toHaveBeenCalledOnce()
  expect(snapshot.unreadableDocuments).toBe(0)
})
it("reports unreadable child documents without losing accessible frame entries", async () => {
  const { target, cross } = fixture()
  cross.executeJavaScript.mockRejectedValue(new Error("detached"))
  const snapshot = await readBrowserFrames(target)
  expect(snapshot.items).toHaveLength(2)
  expect(snapshot.unreadableDocuments).toBe(1)
})
it("rejects stale results if the main document changed during collection", async () => {
  const { target, root } = fixture()
  root.executeJavaScript.mockImplementation(async () => {
    Object.defineProperty(target, "mainFrame", { value: {} as WebFrameMain })
    return { total: 0, items: [] }
  })
  await expect(readBrowserFrames(target)).rejects.toThrow("页面已切换")
})
it("forwards only native child-frame menus so top-level and site menus retain their behavior", () => {
  const top = {}, send = vi.fn()
  const target = Object.assign(new EventEmitter(), { mainFrame: top, send })
  registerFrameContextMenu(target as unknown as WebContents)
  target.emit("context-menu", {}, { frame: top, x: 1, y: 2 })
  expect(send).not.toHaveBeenCalled()
  target.emit("context-menu", {}, { frame: {}, x: 30, y: 40 })
  expect(send).toHaveBeenCalledExactlyOnceWith("vessel:frame-context-menu", { x: 30, y: 40 })
})
