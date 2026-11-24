import { expect, it, vi } from "vitest"
import type { Session } from "electron"
const user = vi.hoisted(() => ({ setProxy: vi.fn(async () => {}), closeAllConnections: vi.fn(async () => {}) }))
vi.mock("electron", () => ({ session: { fromPartition: () => user } }))
import { attachBrowserSessionProxy, detachBrowserSessionProxy, setBrowserSessionProxy, closeBrowserSessionConnections } from "@main/browser/browser-session-proxy"
it("inherits the current proxy, follows later changes, and detaches on private window close", async () => {
  const proxy = { proxyRules: "http=127.0.0.1:9999;https=127.0.0.1:9999" }
  await setBrowserSessionProxy(proxy)
  const browser = { setProxy: vi.fn(async () => {}), closeAllConnections: vi.fn(async () => {}) }
  await attachBrowserSessionProxy(browser as unknown as Session)
  expect(browser.setProxy).toHaveBeenLastCalledWith(proxy)
  await setBrowserSessionProxy({ mode: "system" })
  expect(browser.setProxy).toHaveBeenLastCalledWith({ mode: "system" })
  expect(user.setProxy).toHaveBeenLastCalledWith({ mode: "system" })
  await closeBrowserSessionConnections()
  expect(browser.closeAllConnections).toHaveBeenCalledTimes(2)
  detachBrowserSessionProxy(browser as unknown as Session)
  browser.setProxy.mockClear()
  await setBrowserSessionProxy(proxy)
  expect(browser.setProxy).not.toHaveBeenCalled()
})
