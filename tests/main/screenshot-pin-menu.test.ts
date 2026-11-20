import { expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ template: [] as any[], popup: vi.fn(), copy: vi.fn() }))
vi.mock("electron", () => ({
  clipboard: { writeImage: mocks.copy }, dialog: {},
  Menu: { buildFromTemplate: (template: any[]) => { mocks.template = template; return { popup: mocks.popup } } }
}))
import { registerPinMenu, togglePins } from "@main/screenshot/pin-menu"
it("scopes pin menu actions, placement, visibility and style to the pin window", () => {
  const handlers = new Map<string, (...args: any[]) => unknown>()
  const win = {
    webContents: { ipc: { handle: (key: string, fn: (...args: any[]) => unknown) => handlers.set(key, fn) }, send: vi.fn() },
    setOpacity: vi.fn(), setHasShadow: vi.fn(), setVisibleOnAllWorkspaces: vi.fn(), setAlwaysOnTop: vi.fn(),
    isDestroyed: () => false, isVisible: () => true, hide: vi.fn(), showInactive: vi.fn(), close: vi.fn()
  }
  const image = {} as any
  const pins = new Set<any>([win])
  registerPinMenu(win as any, image, pins)
  handlers.get("shot:pin-menu")!()
  expect(mocks.popup).toHaveBeenCalledWith({ window: win })
  mocks.template.find((entry) => entry.label === "复制").click()
  expect(mocks.copy).toHaveBeenCalledWith(image)
  mocks.template.find((entry) => entry.label === "当前桌面置顶").click()
  expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, "floating")
  expect(win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(false, expect.any(Object))
  mocks.template.find((entry) => entry.label === "展开 / 收起样式工具条").click()
  expect(win.webContents.send).toHaveBeenCalledWith("shot:pin-style-toggle")
  handlers.get("shot:pin-style")!({}, { opacity: -10, shadow: false })
  expect(win.setOpacity).toHaveBeenCalledWith(0.2)
  expect(win.setHasShadow).toHaveBeenCalledWith(false)
  togglePins(pins)
  expect(win.hide).toHaveBeenCalledOnce()
  win.isVisible = () => false
  togglePins(pins)
  expect(win.showInactive).toHaveBeenCalledOnce()
  mocks.template.find((entry) => entry.label === "从桌面移除").click()
  expect(win.close).toHaveBeenCalledOnce()
})

it("moves only its own pin after a left drag starts and stops when it ends", () => {
 const handlers = new Map<string, (...args: any[]) => unknown>()
 const win = { webContents: { ipc: { handle: (key: string, fn: (...args: any[]) => unknown) => handlers.set(key, fn) } }, getPosition: () => [100, 200], setPosition: vi.fn() }
 registerPinMenu(win as any, {} as any, new Set())
 const drag = handlers.get('shot:pin-drag')!
 drag({}, { phase: 'move', x: 20, y: 30 })
 expect(win.setPosition).not.toHaveBeenCalled()
 drag({}, { phase: 'start', x: 10, y: 20 })
 drag({}, { phase: 'move', x: 40, y: 70 })
 expect(win.setPosition).toHaveBeenCalledWith(130, 250)
 drag({}, { phase: 'end' })
 drag({}, { phase: 'move', x: 50, y: 90 })
 expect(win.setPosition).toHaveBeenCalledOnce()
})
