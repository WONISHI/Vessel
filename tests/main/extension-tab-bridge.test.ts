import { expect, it, vi } from "vitest"
import { registerExtensionTabBridge, openExtensionTab } from "@main/browser/extensions/extension-tab-bridge"
it("requires a registered capability and rejects executable or filesystem targets", () => {
  const open = vi.fn(() => true)
  const token = registerExtensionTabBridge(open)
  expect(openExtensionTab("invalid", "https://example.com")).toBe(false)
  expect(openExtensionTab(token, "javascript:alert(1)")).toBe(false)
  expect(openExtensionTab(token, "file:///etc/passwd")).toBe(false)
  expect(open).not.toHaveBeenCalled()
  expect(openExtensionTab(token, "chrome-extension://local-id/login.html")).toBe(true)
  expect(open).toHaveBeenCalledExactlyOnceWith("chrome-extension://local-id/login.html")
})
