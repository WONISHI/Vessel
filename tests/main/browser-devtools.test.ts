import { EventEmitter } from "node:events"
import { beforeEach, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>(), guest: undefined as any, window: undefined as any, panel: undefined as any, detached: undefined as any, follow: false }))
vi.mock("@main/settings/settings", async () => ({ generalSettings: () => ({ browserDevtoolsFollowWindow: mock.follow }), settingsEvents: new (await import("node:events")).EventEmitter() }))
vi.mock("electron", () => ({
  BrowserWindow: class extends EventEmitter {
    static fromWebContents() { return mock.window }
    contentView = { addChildView: vi.fn(), removeChildView: vi.fn() }
    bounds = { x: 20, y: 30, width: 1000, height: 600 }
    visible = true
    destroyed = false
    parent = null as any
    setTitle = vi.fn()
    getNormalBounds() { return this.bounds }
    getBounds() { return this.bounds }
    setBounds(bounds: any) { this.bounds = bounds }
    isFocused() { return false }
    setAlwaysOnTop = vi.fn()
    setVisibleOnAllWorkspaces = vi.fn()
    getContentSize() { return [this.bounds.width, this.bounds.height] }
    isDestroyed() { return this.destroyed }
    isVisible() { return this.visible }
    getParentWindow() { return this.parent }
    setParentWindow(parent: any) { this.parent = parent }
    hide() { this.visible = false }
    showInactive() { this.visible = true }
    destroy() { this.destroyed = true }
    constructor(public options: any) { super(); this.bounds = { ...this.bounds, ...options }; this.visible = options.show !== false; mock.detached = this }
  },
  webContents: { fromId: () => mock.guest },
  WebContentsView: class {
    visible = true
    webContents = Object.assign(new EventEmitter(), {
      ipc: Object.assign(new EventEmitter(), { handle: vi.fn() }), isDestroyed: () => false, close: vi.fn(), send: vi.fn(), isLoading: () => false,
      capturePage: vi.fn().mockResolvedValue({ toDataURL: () => "data:image/png;base64,console" }), setZoomFactor: vi.fn(), insertCSS: vi.fn().mockResolvedValue("css"), removeInsertedCSS: vi.fn(), executeJavaScript: vi.fn().mockResolvedValue(undefined)
    })
    setBounds = vi.fn()
    setVisible(value: boolean) { this.visible = value }
    getVisible() { return this.visible }
    constructor() { mock.panel = this }
  }
}))
vi.mock("@vessel/utils", () => ({ matchesShortcut: () => false }))
import { registerBrowserDevtools } from "../../src/main/browser/browser-devtools"
import { settingsEvents } from "@main/settings/settings"

const ownerWindow = () => Object.assign(new EventEmitter(), {
  contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
  getContentBounds: () => ({ width: 1000, height: 800 }),
  isDestroyed: () => false, isVisible: () => true, isMinimized: () => false, isFocused: () => true,
  isFullScreen: () => false, isSimpleFullScreen: () => false
})
beforeEach(() => { mock.follow = false })

it("attaches DevTools before inspecting and mirrors the host control above its native surface", () => {
  const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler) }, isDestroyed: () => false, send: vi.fn() })
  const order: string[] = []
  mock.guest = Object.assign(new EventEmitter(), { id: 7, hostWebContents: host, session: {}, isDestroyed: () => false, closeDevTools: vi.fn(), setDevToolsWebContents: () => order.push("attach"), openDevTools: () => order.push("open"), inspectElement: vi.fn(() => order.push("inspect")) })
  mock.window = ownerWindow()
  registerBrowserDevtools(host as any)
  const sync = mock.handlers.get("browser:devtools")!
  const control = { x: 900, y: 250, width: 48, height: 48, icon: "<svg/>", color: "gray", background: "white", border: "gray", shadow: "none" }
  sync({}, 7, { x: 52, y: 400, width: 948, height: 368 }, { font: "Menlo", size: 13, inspect: { x: 110, y: 90 }, control })
  expect(order).toEqual(["attach", "open", "inspect"])
  expect(mock.panel.webContents.executeJavaScript).not.toHaveBeenCalled()
  mock.guest.emit("devtools-opened")
  expect(mock.panel.webContents.executeJavaScript).toHaveBeenCalledOnce()
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
  sync({}, null)
  expect(mock.guest.listenerCount("devtools-opened")).toBe(0)
})

it("keeps detached geometry on tab switches, inspects elements and disables throttling only while inspected", () => {
  const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler) }, isDestroyed: () => false, send: vi.fn() })
  const guest = (id: number) => Object.assign(new EventEmitter(), {
    id, hostWebContents: host, session: {}, isDestroyed: () => false,
    closeDevTools: vi.fn(), setDevToolsWebContents: vi.fn(), openDevTools: vi.fn(), inspectElement: vi.fn(),
    getTitle: () => "Page " + id, getURL: () => "https://example.com/" + id,
    getBackgroundThrottling: () => true, setBackgroundThrottling: vi.fn()
  })
  mock.guest = guest(7)
  mock.window = ownerWindow()
  registerBrowserDevtools(host as any)
  const sync = mock.handlers.get("browser:devtools")!
  const bounds = { x: 0, y: 0, width: 800, height: 600 }
  const options = { font: "Menlo", size: 13, detached: true, pageTitle: "Tab", pageURL: "https://example.com/typed" }
  sync({}, 7, bounds, options)
  expect(mock.detached.options).toMatchObject({ fullscreen: false, fullscreenable: false })
  expect(mock.detached.options.parent).toBeUndefined()
  expect(mock.detached.setTitle).toHaveBeenLastCalledWith("Tab · https://example.com/typed")
  expect(mock.guest.setBackgroundThrottling).toHaveBeenCalledWith(false)
  sync({}, 7, bounds, { ...options, inspect: { x: 120, y: 80 } })
  expect(mock.guest.inspectElement).toHaveBeenCalledExactlyOnceWith(120, 80)
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

it("moves the live console between docked and detached windows without reopening DevTools", () => {
  const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler) }, isDestroyed: () => false, send: vi.fn() })
  mock.guest = Object.assign(new EventEmitter(), {
    id: 7, hostWebContents: host, session: {}, isDestroyed: () => false,
    closeDevTools: vi.fn(), setDevToolsWebContents: vi.fn(), openDevTools: vi.fn(),
    getTitle: () => "Page", getURL: () => "https://example.com",
    getBackgroundThrottling: () => true, setBackgroundThrottling: vi.fn()
  })
  mock.window = ownerWindow()
  registerBrowserDevtools(host as any)
  const sync = mock.handlers.get("browser:devtools")!
  const bounds = { x: 0, y: 400, width: 1000, height: 300 }
  const options = { font: "Menlo", size: 13 }
  const control = { x: 900, y: 250, width: 48, height: 48, icon: "<svg/>", color: "gray", background: "white", border: "gray", shadow: "none" }
  sync({}, 7, bounds, { ...options, control })
  const panel = mock.panel
  sync({}, 7, bounds, { ...options, detached: true })
  const detached = mock.detached
  expect(mock.panel).toBe(panel)
  expect(mock.window.contentView.removeChildView).toHaveBeenCalledWith(panel)
  expect(detached.contentView.addChildView).toHaveBeenCalledWith(panel)
  expect(panel.webContents.send).toHaveBeenLastCalledWith("browser:control-overlay", undefined)
  expect(mock.guest.setBackgroundThrottling).toHaveBeenLastCalledWith(false)
  sync({}, 7, bounds, options)
  expect(detached.contentView.removeChildView).toHaveBeenCalledWith(panel)
  expect(detached.destroyed).toBe(true)
  expect(mock.window.contentView.addChildView).toHaveBeenLastCalledWith(panel)
  expect(panel.setBounds).toHaveBeenLastCalledWith(bounds)
  expect(mock.guest.setBackgroundThrottling).toHaveBeenLastCalledWith(true)
  expect(mock.guest.setDevToolsWebContents).toHaveBeenCalledOnce()
  expect(mock.guest.openDevTools).toHaveBeenCalledOnce()
  expect(mock.guest.closeDevTools).not.toHaveBeenCalled()
  expect(panel.webContents.close).not.toHaveBeenCalled()
  sync({}, null)
  expect(mock.guest.closeDevTools).toHaveBeenCalledOnce()
})

it("applies the follow setting to the existing detached console and cleans up on docking", () => {
  const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler) }, isDestroyed: () => false, send: vi.fn() })
  mock.guest = Object.assign(new EventEmitter(), {
    id: 7, hostWebContents: host, session: {}, isDestroyed: () => false,
    closeDevTools: vi.fn(), setDevToolsWebContents: vi.fn(), openDevTools: vi.fn(),
    getTitle: () => "Page", getURL: () => "https://example.com",
    getBackgroundThrottling: () => true, setBackgroundThrottling: vi.fn()
  })
  mock.window = ownerWindow()
  registerBrowserDevtools(host as any)
  const sync = mock.handlers.get("browser:devtools")!
  const bounds = { x: 0, y: 400, width: 1000, height: 300 }
  const options = { font: "Menlo", size: 13, detached: true }
  const listenerCount = settingsEvents.listenerCount("changed")
  sync({}, 7, bounds, options)
  const detached = mock.detached, panel = mock.panel
  expect(detached.getParentWindow()).toBeNull()
  mock.follow = true
  settingsEvents.emit("changed")
  expect(detached.getParentWindow()).toBe(mock.window)
  expect(mock.detached).toBe(detached)
  expect(mock.panel).toBe(panel)
  expect(mock.guest.openDevTools).toHaveBeenCalledOnce()
  mock.follow = false
  settingsEvents.emit("changed")
  expect(detached.getParentWindow()).toBeNull()
  sync({}, 7, bounds, { ...options, detached: false })
  expect(settingsEvents.listenerCount("changed")).toBe(listenerCount)
  expect(mock.window.listenerCount("show")).toBe(0)
  sync({}, null)
})

it("retains a console preview under overlapping portals and drops stale captures", async () => {
  const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler) }, isDestroyed: () => false, send: vi.fn() })
  mock.guest = Object.assign(new EventEmitter(), { id: 7, hostWebContents: host, session: {}, isDestroyed: () => false, closeDevTools: vi.fn(), setDevToolsWebContents: vi.fn(), openDevTools: vi.fn() })
  mock.window = ownerWindow()
  registerBrowserDevtools(host as any)
  const sync = mock.handlers.get("browser:devtools")!
  const bounds = { x: 52, y: 400, width: 948, height: 368 }
  const options = { font: "Menlo", size: 13 }
  sync({}, 7, bounds, options)
  sync({}, 7, bounds, { ...options, hidden: true, occluded: true })
  await Promise.resolve()
  expect(host.send).toHaveBeenCalledWith("browser:devtools-preview", { id: 7, image: "data:image/png;base64,console" })
  await vi.waitFor(() => expect(mock.panel.getVisible()).toBe(false))
  expect(mock.panel.webContents.capturePage).toHaveBeenCalledOnce()
  sync({}, 7, bounds, { ...options, hidden: true, occluded: true })
  expect(mock.panel.webContents.capturePage).toHaveBeenCalledOnce()
  sync({}, 7, bounds, options)
  expect(host.send).toHaveBeenLastCalledWith("browser:devtools-preview", { id: 7 })
  expect(mock.panel.getVisible()).toBe(true)
  let finish!: (image: any) => void
  mock.panel.webContents.capturePage.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  sync({}, 7, bounds, { ...options, hidden: true, occluded: true })
  sync({}, 7, bounds, options)
  host.send.mockClear()
  finish({ toDataURL: () => "stale" })
  await Promise.resolve()
  expect(host.send).not.toHaveBeenCalled()
})
