import { expect, it, vi } from "vitest"
import type { WebContents } from "electron"
vi.mock("../../src/main/browser-devtools", () => ({ registerBrowserDevtools: vi.fn() }))
import { secureBrowserGuests } from "../../src/main/browser-security"
it("opens guest links and popups as Vessel tabs while blocking unsafe schemes", () => {
  const hostEvents = new Map<string, Function>()
  const guestEvents = new Map<string, Function>()
  const send = vi.fn()
  const popup = vi.fn()
  const guest = { on: (name: string, handler: Function) => guestEvents.set(name, handler), setWindowOpenHandler: popup, session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } }
  secureBrowserGuests({ on: (name: string, handler: Function) => hostEvents.set(name, handler), send } as unknown as WebContents)
  hostEvents.get("did-attach-webview")!({}, guest)
  const preventDefault = vi.fn()
  guestEvents.get("will-navigate")!({ preventDefault }, "https://example.com/docs")
  expect(preventDefault).toHaveBeenCalled()
  expect(send).toHaveBeenCalledWith("browser:new-tab", "https://example.com/docs")
  expect(popup.mock.calls[0][0]({ url: "https://example.com/new" })).toEqual({ action: "deny" })
  expect(send).toHaveBeenLastCalledWith("browser:new-tab", "https://example.com/new")
  guestEvents.get("will-navigate")!({ preventDefault }, "file:///secret")
  expect(send).toHaveBeenCalledTimes(2)
})
