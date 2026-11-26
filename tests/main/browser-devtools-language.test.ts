import type { WebContents } from "electron"
import { expect, it, vi } from "vitest"
import { applyBrowserDevtoolsLanguage } from "../../src/main/browser/browser-devtools-language"

it("reloads only the DevTools frontend when its native locale setting changes", async () => {
  const target = { isDestroyed: () => false, executeJavaScript: vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false), reload: vi.fn() }
  expect(await applyBrowserDevtoolsLanguage(target as unknown as WebContents, "zh")).toBe(true)
  expect(target.reload).toHaveBeenCalledOnce()
  await applyBrowserDevtoolsLanguage(target as unknown as WebContents, "zh")
  expect(target.reload).toHaveBeenCalledOnce()
  expect(target.executeJavaScript.mock.calls[0][0]).toContain("moduleSetting('language')")
})
it("serializes rapid language changes and refuses unsupported locale input", async () => {
  const target = { isDestroyed: () => false, executeJavaScript: vi.fn().mockResolvedValue(true), reload: vi.fn() }
  await Promise.all([applyBrowserDevtoolsLanguage(target as unknown as WebContents, "zh"), applyBrowserDevtoolsLanguage(target as unknown as WebContents, "en-US")])
  expect(target.executeJavaScript.mock.calls[1][0]).toContain('"en-US"')
  await expect(applyBrowserDevtoolsLanguage(target as unknown as WebContents, "invalid" as "zh")).rejects.toThrow("语言无效")
})
