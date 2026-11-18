import { EventEmitter } from "node:events"
import { expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>(), guest: undefined as any, window: undefined as any, panel: undefined as any, detached: undefined as any }))
vi.mock("electron", () => ({
  BrowserWindow: class extends EventEmitter {
    static fromWebContents() { return mock.window }
    contentView = { addChildView: vi.fn(), removeChildView: vi.fn() }
    bounds = { x: 20, y: 30, width: 1000, height: 600 }
    visible = true
    destroyed = false
    setTitle = vi.fn()
    getNormalBounds() { return this.bounds }
    getContentSize() { return [this.bounds.width, this.bounds.height] }
    isDestroyed() { return this.destroyed }
    isVisible() { return this.visible }
    hide() { this.visible = false }
    showInactive() { this.visible = true }
    destroy() { this.destroyed = true }
    constructor(public options: any) { super(); this.bounds = { ...this.bounds, ...options }; mock.detached = this }
  },
  webContents: { fromId: () => mock.guest },
  WebContentsView: class {
    visible = true
    webContents = Object.assign(new EventEmitter(), {
      ipc: new EventEmitter(), isDestroyed: () => false, close: vi.fn(), send: vi.fn(), isLoading: () => false,
      setZoomFactor: vi.fn(), insertCSS: vi.fn().mockResolvedValue("css"), removeInsertedCSS: vi.fn()
    })
    setBounds = vi.fn()
    setVisible(value: boolean) { this.visible = value }
    getVisible() { return this.visible }
    constructor() { mock.panel = this }
  }
}))
vi.mock("@vessel/utils", () => ({ matchesShortcut: () => false }))
import { registerBrowserDevtools } from "../../src/main/browser/browser-devtools"

it("attaches DevTools before inspecting and mirrors the host control above its native surface", () => {
  const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler) }, isDestroyed: () => false, send: vi.fn() })
  const order: string[] = []
  mock.guest = Object.assign(new EventEmitter(), { id: 7, hostWebContents: host, session: {}, isDestroyed: () => false, closeDevTools: vi.fn(), setDevToolsWebContents: () => order.push("attach"), openDevTools: () => order.push("open"), inspectElement: vi.fn(() => order.push("inspect")) })
  mock.window = { contentView: { addChildView: vi.fn(), removeChildView: vi.fn() }, getContentBounds: () => ({ width: 1000, height: 800 }) }
  registerBrowserDevtools(host as any)
  const sync = mock.handlers.get("browser:devtools")!
  const control = { x: 900, y: 250, width: 48, height: 48, icon: "<svg/>", color: "gray", background: "white", border: "gray", shadow: "none" }
  sync({}, 7, { x: 52, y: 400, width: 948, height: 368 }, { font: "Menlo", size: 13, inspect: { x: 110, y: 90 }, control })
  expect(order).toEqual(["attach", "open", "inspect"])
  expect(mock.guest.inspectElement).toHaveBeenCalledWith(110, 90)
  expect(mock.panel.webContents.send).toHaveBeenCalledWith("browser:control-overlay", control)
  mock.panel.webContents.ipc.emit("browser:devtools-control", {})
  expect(host.send).toHaveBeenCalledWith("browser:control", undefined)
  sync({}, 7, { x: 52, y: 400, width: 948, height: 368 }, { font: "Menlo", size: 13, hidden: true })
  expect(mock.panel.visible).toBe(false)
  host.send.mockClear()
  mock.panel.webContents.ipc.emit("browser:devtools-control", {})
  expect(host.send).not.toHaveBeenCalled()
  expect(order).toEqual(["attach", "open", "inspect"])
})

it("keeps detached geometry on tab switches, updates page titles and disables throttling only while inspected", () => {
  const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler) }, isDestroyed: () => false, send: vi.fn() })
  const guest = (id: number) => Object.assign(new EventEmitter(), {
    id, hostWebContents: host, session: {}, isDestroyed: () => false,
    closeDevTools: vi.fn(), setDevToolsWebContents: vi.fn(), openDevTools: vi.fn(),
    getTitle: () => "Page " + id, getURL: () => "https://example.com/" + id,
    getBackgroundThrottling: () => true, setBackgroundThrottling: vi.fn()
  })
  mock.guest = guest(7)
  mock.window = { contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } }
  registerBrowserDevtools(host as any)
  const sync = mock.handlers.get("browser:devtools")!
  const bounds = { x: 0, y: 0, width: 800, height: 600 }
  const options = { font: "Menlo", size: 13, detached: true, pageTitle: "Tab", pageURL: "https://example.com/typed" }
  sync({}, 7, bounds, options)
  expect(mock.detached.options).toMatchObject({ fullscreen: false, fullscreenable: false })
  expect(mock.detached.options.parent).toBeUndefined()
  expect(mock.detached.setTitle).toHaveBeenLastCalledWith("Tab · https://example.com/typed")
  expect(mock.guest.setBackgroundThrottling).toHaveBeenCalledWith(false)
  const originalWindow = mock.detached
  sync({}, 7, bounds, { ...options, pageTitle: "Updated tab" })
  expect(mock.detached).toBe(originalWindow)
  expect(mock.detached.setTitle).toHaveBeenLastCalledWith("Updated tab · https://example.com/typed")
  mock.detached.bounds = { x: 140, y: 180, width: 900, height: 680 }
  const first = mock.guest
  mock.guest = guest(8)
  sync({}, 8, bounds, { ...options, pageTitle: "Second" })
  expect(mock.detached.options).toMatchObject({ x: 140, y: 180, width: 900, height: 680 })
  expect(first.setBackgroundThrottling).toHaveBeenLastCalledWith(true)
  expect(first.listenerCount("did-navigate-in-page")).toBe(0)
  expect(mock.detached.setTitle).toHaveBeenLastCalledWith("Second · https://example.com/typed")
  sync({}, null)
  expect(mock.guest.setBackgroundThrottling).toHaveBeenLastCalledWith(true)
  expect(mock.detached.destroyed).toBe(true)
})
