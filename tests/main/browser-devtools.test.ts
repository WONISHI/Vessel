import { EventEmitter } from "node:events"
import { expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>(), guest: undefined as any, window: undefined as any, panel: undefined as any }))
vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: () => mock.window },
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
