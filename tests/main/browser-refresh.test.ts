import { EventEmitter } from "node:events"
import { expect, it, vi } from "vitest"

vi.mock("@main/settings/settings", () => ({ shouldMonitorNavigation: () => false, generalSettings: () => ({}) }))
vi.mock("@main/vault/service", () => ({ attachVaultGuest: vi.fn() }))
vi.mock("@main/browser/browser-proxy", () => ({ registerBrowserProxy: vi.fn() }))
vi.mock("@main/browser/browser-tools", () => ({ registerBrowserTools: vi.fn() }))
vi.mock("@main/browser/browser-extensions", () => ({ registerBrowserExtensions: vi.fn() }))
vi.mock("@main/browser/browser-devtools", () => ({ registerBrowserDevtools: vi.fn() }))
vi.mock("@vessel/utils", () => ({ commandShortcutIds: [], matchesShortcut: () => false }))
vi.mock("electron", () => ({ session: { fromPartition: () => ({}) } }))
import { secureBrowserGuests } from "@main/browser/browser-security"

it("uses normal navigation reload for toolbar and F5 so Service Workers can control the next document", () => {
  const handlers = new Map<string, (...args: any[]) => any>()
  const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) }, send: vi.fn(), isDestroyed: () => false })
  secureBrowserGuests(host as any)
  const guest = Object.assign(new EventEmitter(), {
    id: 10, ipc: new EventEmitter(), getURL: () => "http://localhost:9525/",
    session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() },
    setWindowOpenHandler: vi.fn(), isDestroyed: () => false,
    reload: vi.fn(), reloadIgnoringCache: vi.fn()
  })
  host.emit("did-attach-webview", {}, guest)
  handlers.get("browser:reload-tab")!({}, 10)
  const preventDefault = vi.fn()
  guest.emit("before-input-event", { preventDefault }, { type: "keyDown", code: "F5" })
  expect(guest.reload).toHaveBeenCalledTimes(2)
  expect(guest.reloadIgnoringCache).not.toHaveBeenCalled()
  expect(preventDefault).toHaveBeenCalledOnce()
  guest.emit("before-input-event", { preventDefault }, { type: "keyDown", code: "F5", isAutoRepeat: true })
  expect(guest.reload).toHaveBeenCalledTimes(2)
  host.emit("destroyed")
})
