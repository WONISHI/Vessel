import { expect, it, vi } from "vitest"
import type { WebContents } from "electron"
vi.mock("../../src/main/browser-tools", () => ({ registerBrowserTools: vi.fn() }))
vi.mock("../../src/main/browser-extensions", () => ({ registerBrowserExtensions: vi.fn() }))
vi.mock("electron", () => ({ session: { fromPartition: vi.fn(() => ({})) } }))
vi.mock("../../src/main/browser-devtools", () => ({ registerBrowserDevtools: vi.fn() }))
import { secureBrowserGuests } from "../../src/main/browser-security"
it("keeps document redirects in place and opens popups as Vessel tabs while blocking unsafe schemes", () => {
  const hostEvents = new Map<string, Function>()
  const guestEvents = new Map<string, Function>()
  const send = vi.fn()
  const popup = vi.fn()
  const guest = { id: 10, getURL: () => "http://localhost:5173/", on: (name: string, handler: Function) => guestEvents.set(name, handler), setWindowOpenHandler: popup, session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } }
  secureBrowserGuests({ on: (name: string, handler: Function) => hostEvents.set(name, handler), send } as unknown as WebContents)
  hostEvents.get("did-attach-webview")!({}, guest)
  const preventDefault = vi.fn()
  guestEvents.get("will-navigate")!({ preventDefault }, "https://example.com/docs")
  expect(preventDefault).not.toHaveBeenCalled()
  expect(send).not.toHaveBeenCalled()
  expect(popup.mock.calls[0][0]({ url: "https://example.com/new" })).toEqual({ action: "deny" })
  expect(send).toHaveBeenLastCalledWith("browser:new-tab", "https://example.com/new")
  preventDefault.mockClear()
  guestEvents.get("will-navigate")!({ preventDefault }, "http://localhost:5173/")
  expect(preventDefault).not.toHaveBeenCalled()
  guestEvents.get("will-navigate")!({ preventDefault }, "file:///secret")
  expect(send).toHaveBeenCalledTimes(1)
  preventDefault.mockClear()
  guestEvents.get("will-navigate")!({ preventDefault }, "http://localhost:8080/")
  expect(preventDefault).not.toHaveBeenCalled()
  for (const key of [{ control: true }, { meta: true }]) {
    guestEvents.get("before-input-event")!({ preventDefault }, { type: "keyDown", key: "f", ...key })
    expect(send).toHaveBeenLastCalledWith("browser:find", 10)
  }
})
