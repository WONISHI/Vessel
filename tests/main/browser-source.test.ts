import { expect, it, vi } from "vitest"
import type { WebContents } from "electron"
import { readBrowserSource } from "@main/browser/browser-source"

function guest() {
  return { getURL: vi.fn(() => "https://site.test/form/detail"), isDestroyed: () => false, session: { fetch: vi.fn().mockResolvedValue({ ok: true, text: async () => "<!DOCTYPE html><html>original</html>" }) }, executeJavaScript: vi.fn().mockResolvedValue("<!DOCTYPE html>\n<html>loaded page</html>") }
}
it("prefers original source when it can be fetched", async () => {
  const target = guest()
  expect(await readBrowserSource(target as unknown as WebContents)).toContain("original")
  expect(target.executeJavaScript).not.toHaveBeenCalled()
})
it.each(["404", "network"])("reads the loaded document when a repeated request fails: %s", async failure => {
  const target = guest()
  if (failure === "404") target.session.fetch.mockResolvedValue({ ok: false, status: 404 })
  else target.session.fetch.mockRejectedValue(new Error("offline"))
  expect(await readBrowserSource(target as unknown as WebContents)).toContain("loaded page")
  expect(target.executeJavaScript.mock.calls[0][0]).toContain("document.documentElement.outerHTML")
  expect(target.executeJavaScript.mock.calls[0][0]).toContain("document.doctype")
})
it("rejects oversized source and a navigation during loading", async () => {
  const target = guest()
  target.session.fetch.mockResolvedValue({ ok: true, text: async () => "x".repeat(4 * 1024 * 1024 + 1) })
  await expect(readBrowserSource(target as unknown as WebContents)).rejects.toThrow("网页源代码过大")
  expect(target.executeJavaScript).not.toHaveBeenCalled()
  target.getURL.mockReturnValueOnce("https://site.test/form/detail").mockReturnValue("https://other.test")
  await expect(readBrowserSource(target as unknown as WebContents)).rejects.toThrow("页面已切换")
})
it("does not execute source extraction for unsupported addresses", async () => {
  const target = guest()
  target.getURL.mockReturnValue("javascript:alert(1)")
  await expect(readBrowserSource(target as unknown as WebContents)).rejects.toThrow("不支持的网页地址")
  expect(target.session.fetch).not.toHaveBeenCalled()
})
