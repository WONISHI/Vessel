import { expect, it, vi } from "vitest"
import type { Session } from "electron"
import { loadExtensionWithWorker } from "@main/browser/extensions/extension-worker"

function setup(worker: boolean) {
  const extension = { id: "demo", manifest: { background: worker ? { service_worker: "sw.js" } : { scripts: ["bg.js"] } } }
  const browser = { extensions: { loadExtension: vi.fn().mockResolvedValue(extension), removeExtension: vi.fn() }, serviceWorkers: { startWorkerForScope: vi.fn().mockResolvedValue({}) } }
  return { extension, browser, session: browser as unknown as Session }
}
it("checks MV3 worker startup after loading", async () => {
  const { extension, browser, session } = setup(true)
  expect(await loadExtensionWithWorker(session, "/extension")).toBe(extension)
  expect(browser.serviceWorkers.startWorkerForScope).toHaveBeenCalledWith("chrome-extension://demo/")
})
it("retries a failed worker once without clearing extension data", async () => {
  const { browser, session } = setup(true)
  browser.serviceWorkers.startWorkerForScope.mockRejectedValueOnce(new Error("Status code: 2"))
  await loadExtensionWithWorker(session, "/extension")
  expect(browser.extensions.loadExtension).toHaveBeenCalledTimes(2)
  expect(browser.extensions.removeExtension).toHaveBeenCalledTimes(1)
})
it("reports persistent failure instead of marking a broken worker loaded", async () => {
  const { browser, session } = setup(true)
  browser.serviceWorkers.startWorkerForScope.mockRejectedValue(new Error("worker failed"))
  await expect(loadExtensionWithWorker(session, "/extension")).rejects.toThrow("扩展后台启动失败")
  expect(browser.extensions.loadExtension).toHaveBeenCalledTimes(2)
})
it("does not start workers for MV2 background pages", async () => {
  const { browser, session } = setup(false)
  await loadExtensionWithWorker(session, "/extension")
  expect(browser.serviceWorkers.startWorkerForScope).not.toHaveBeenCalled()
})
