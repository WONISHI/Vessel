import { EventEmitter } from "node:events"
import { expect, it, vi } from "vitest"
import { loadExtensionPage, registerExtensionNavigation } from "@main/browser/extensions/extension-navigation"
it("answers shared preload IPC in extension popups and routes login links safely", async () => {
  const ipc = new EventEmitter()
  const open = vi.fn()
  registerExtensionNavigation({ ipc, isDestroyed: () => false } as never, "test", open)
  const anchor = { returnValue: undefined as unknown }
  ipc.emit("vessel:anchor-navigation", anchor, "https://example.com/login")
  expect(anchor.returnValue).toBe(true)
  const event = { returnValue: undefined as unknown }
  ipc.emit("vessel:navigation-choice", event, "chrome-extension://test/login.html")
  expect(event.returnValue).toBe(true)
  for (const target of ["javascript:alert(1)", "chrome-extension://other/login.html", null]) {
    ipc.emit("vessel:navigation-choice", event, target)
    expect(event.returnValue).toBe(false)
  }
  ipc.emit("vessel:navigation-choice", event, "https://example.com/login")
  expect(event.returnValue).toBe(false)
  expect(open).not.toHaveBeenCalled()
  await new Promise(setImmediate)
  expect(open).toHaveBeenCalledExactlyOnceWith("https://example.com/login")
})
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
