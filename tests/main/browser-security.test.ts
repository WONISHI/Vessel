const monitor = vi.hoisted(() => vi.fn(() => true))
vi.mock("@main/settings/settings", () => ({ shouldMonitorNavigation: monitor }))
vi.mock("@main/browser/browser-proxy", () => ({ registerBrowserProxy: vi.fn() }))
import { expect, it, vi } from "vitest"
import type { WebContents } from "electron"
vi.mock("@main/browser/browser-tools", () => ({ registerBrowserTools: vi.fn() }))
vi.mock("@main/browser/browser-extensions", () => ({ registerBrowserExtensions: vi.fn() }))
const choice = vi.hoisted(() => vi.fn(() => 0))
const preconnect = vi.hoisted(() => vi.fn())
vi.mock("electron", () => ({ BrowserWindow: { fromWebContents: () => ({}) }, dialog: { showMessageBoxSync: choice }, session: { fromPartition: vi.fn(() => ({ preconnect })) } }))
vi.mock("@main/browser/browser-devtools", () => ({ registerBrowserDevtools: vi.fn() }))
import { secureBrowserGuests } from "@main/browser/browser-security"
it("asks before navigation, preserves current requests and opens confirmed new tabs", () => {
  const hostEvents = new Map<string, Function>()
  const guestEvents = new Map<string, Function>()
  const send = vi.fn()
  const popup = vi.fn()
  const guestIPC = new Map<string, Function>()
  const reload = vi.fn()
  const guest = {
    reload,
    ipc: { on: (name: string, handler: Function) => guestIPC.set(name, handler) },
    isDestroyed: () => false,
    loadURL: vi.fn(async () => {}),
    id: 10,
    getURL: () => "http://localhost:5173/",
    on: (name: string, handler: Function) => guestEvents.set(name, handler),
    setWindowOpenHandler: popup,
    session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() }
  }
  secureBrowserGuests({ on: (name: string, handler: Function) => hostEvents.set(name, handler), send, isDestroyed: () => false } as unknown as WebContents)
  hostEvents.get("did-attach-webview")!({}, guest)
  const preventDefault = vi.fn()
  guestEvents.get("will-navigate")!({ preventDefault }, "https://example.com/docs")
  expect(preventDefault).not.toHaveBeenCalled()
  expect(send).not.toHaveBeenCalled()
  choice.mockReturnValueOnce(1)
  expect(popup.mock.calls[0][0]({ url: "https://example.com/new" })).toEqual({ action: "deny" })
  expect(send).toHaveBeenLastCalledWith("browser:new-tab", "https://example.com/new", 10)
  preventDefault.mockClear()
  guestEvents.get("will-navigate")!({ preventDefault }, "http://localhost:5173/")
  expect(preventDefault).not.toHaveBeenCalled()
  guestEvents.get("will-navigate")!({ preventDefault }, "file:///secret")
  expect(send).toHaveBeenCalledTimes(1)
  preventDefault.mockClear()
  guestEvents.get("will-navigate")!({ preventDefault }, "http://localhost:8080/")
  expect(preventDefault).not.toHaveBeenCalled()
  choice.mockReturnValueOnce(2)
  guestEvents.get("will-navigate")!({ preventDefault }, "https://example.com/cancel")
  expect(preventDefault).toHaveBeenCalledTimes(1)
  preventDefault.mockClear()
  guestEvents.get("will-navigate")!({ preventDefault }, "javascript:alert(1)")
  expect(preventDefault).toHaveBeenCalledTimes(1)
  preventDefault.mockClear()
  choice.mockClear()
  guestIPC.get("vessel:anchor-navigation")!({}, "https://example.com/link")
  guestEvents.get("will-navigate")!({ preventDefault }, "https://example.com/link")
  expect(choice).not.toHaveBeenCalled()
  expect(preventDefault).not.toHaveBeenCalled()
  monitor.mockReturnValue(false)
  guestEvents.get("will-navigate")!({ preventDefault }, "https://example.com/disabled")
  popup.mock.calls[0][0]({ url: "https://example.com/popup" })
  expect(choice).not.toHaveBeenCalled()
  expect(send).toHaveBeenLastCalledWith("browser:new-tab", "https://example.com/popup", 10)
  preventDefault.mockClear()
  guestEvents.get("before-input-event")!({ preventDefault }, { type: "keyDown", key: "F5" })
  expect(reload).toHaveBeenCalledTimes(1)
  expect(preventDefault).toHaveBeenCalledTimes(1)
  guestEvents.get("before-input-event")!({ preventDefault }, { type: "keyDown", key: "F5", isAutoRepeat: true })
  expect(reload).toHaveBeenCalledTimes(1)
  preventDefault.mockClear()
  guestEvents.get("before-input-event")!({ preventDefault }, { type: "keyDown", key: "F5", shift: true })
  expect(preventDefault).not.toHaveBeenCalled()
  for (const key of [{ control: true }, { meta: true }]) {
    guestEvents.get("before-input-event")!({ preventDefault }, { type: "keyDown", key: "f", ...key })
    expect(preventDefault).not.toHaveBeenCalled()
  }
})

it("preconnects HTTP pages while keeping local files and rejected guests untouched", () => {
  const events = new Map<string, Function>()
  secureBrowserGuests({ on: (name: string, handler: Function) => events.set(name, handler) } as unknown as WebContents)
  const attach = events.get("will-attach-webview")!
  const preventDefault = vi.fn()
  const preferences: Record<string, unknown> = {}
  attach({ preventDefault }, preferences, { src: "https://example.com/docs", partition: "persist:vessel-browser" })
  expect(preconnect).toHaveBeenCalledWith({ url: "https://example.com/docs", numSockets: 1 })
  expect(preferences.webSecurity).toBe(true)
  preconnect.mockClear()
  attach({ preventDefault }, {}, { src: "file:///tmp/test.html", partition: "persist:vessel-browser" })
  attach({ preventDefault }, {}, { src: "https://example.com", partition: "untrusted" })
  expect(preconnect).not.toHaveBeenCalled()
  expect(preventDefault).toHaveBeenCalledTimes(1)
})
