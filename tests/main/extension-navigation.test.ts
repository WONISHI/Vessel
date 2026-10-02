import { EventEmitter } from "node:events"
import { expect, it, vi } from "vitest"
import { loadExtensionPage } from "../../src/main/extension-navigation"
it("waits for extension redirect instead of rejecting ERR_ABORTED", async () => {
  const contents = Object.assign(new EventEmitter(), { getURL: () => "chrome-extension://test/welcome.html", loadURL: vi.fn().mockRejectedValue(Object.assign(new Error("ERR_ABORTED"), { code: "ERR_ABORTED" })) })
  const pending = loadExtensionPage(contents as never, "chrome-extension://test/main.html")
  await Promise.resolve()
  contents.emit("did-fail-load", {}, -3, "ERR_ABORTED", "chrome-extension://test/main.html", true)
  contents.emit("did-finish-load")
  await expect(pending).resolves.toBeUndefined()
  expect(contents.listenerCount("did-finish-load")).toBe(0)
})
it("reports a genuine main-frame failure", async () => {
  const contents = Object.assign(new EventEmitter(), { getURL: () => "", loadURL: vi.fn().mockResolvedValue(undefined) })
  const pending = loadExtensionPage(contents as never, "chrome-extension://test/main.html")
  contents.emit("did-fail-load", {}, -6, "ERR_FILE_NOT_FOUND", "", true)
  await expect(pending).rejects.toThrow("ERR_FILE_NOT_FOUND")
})
