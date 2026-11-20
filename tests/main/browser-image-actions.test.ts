import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ writeImage: vi.fn(), image: { isEmpty: () => false }, readFile: vi.fn(), writeFile: vi.fn(), save: vi.fn(), notify: vi.fn() }))
vi.mock("electron", () => ({ clipboard: { writeImage: mocks.writeImage }, nativeImage: { createFromBuffer: () => mocks.image }, dialog: { showSaveDialog: mocks.save } }))
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile, writeFile: mocks.writeFile }))
vi.mock("../../src/main/browser/browser-downloads", () => ({ notifyBrowserFileSaved: mocks.notify }))
import { browserImageAction } from "../../src/main/browser/browser-image-actions"
const host = {} as any
const bytes = Buffer.from("original-image")
beforeEach(() => { vi.clearAllMocks(); mocks.readFile.mockResolvedValue(bytes); mocks.save.mockResolvedValue({ canceled: false, filePath: "/saved/photo.png" }); mocks.writeFile.mockResolvedValue(undefined); mocks.notify.mockResolvedValue(undefined) })
function guest(url: string, type = "image/png") {
  return { getURL: () => url, isDestroyed: () => false, executeJavaScript: vi.fn().mockResolvedValue(type), session: { fetch: vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes }) } } as any
}
it("copies the local image bitmap rather than its address", async () => {
  const target = guest("file:///tmp/photo.png")
  await browserImageAction(host, target, "copy-image")
  expect(mocks.readFile).toHaveBeenCalledWith("/tmp/photo.png")
  expect(mocks.writeImage).toHaveBeenCalledWith(mocks.image)
  expect(target.session.fetch).not.toHaveBeenCalled()
})
it("downloads the original remote bytes using the guest session", async () => {
  const target = guest("https://images.test/photo.png?token=example")
  await browserImageAction(host, target, "download-image")
  expect(target.session.fetch).toHaveBeenCalledWith(target.getURL())
  expect(mocks.save).toHaveBeenCalledWith({ title: "下载图片", defaultPath: "photo.png" })
  expect(mocks.writeFile).toHaveBeenCalledWith("/saved/photo.png", bytes)
})
it("does not write a file when canceled or act on HTML with an image-looking URL", async () => {
  mocks.save.mockResolvedValue({ canceled: true })
  await browserImageAction(host, guest("file:///tmp/photo.png"), "download-image")
  expect(mocks.writeFile).not.toHaveBeenCalled()
  await expect(browserImageAction(host, guest("https://site.test/photo.png", "text/html"), "copy-image")).rejects.toThrow("当前页面不是图片资源")
  expect(mocks.writeImage).not.toHaveBeenCalled()
})
