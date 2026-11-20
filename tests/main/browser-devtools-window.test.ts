import { EventEmitter } from "node:events"
import type { BrowserWindow } from "electron"
import { afterEach, expect, it, vi } from "vitest"
import { bindBrowserDevtoolsWindow } from "../../src/main/browser/browser-devtools-window"

afterEach(() => vi.useRealTimers())

function fixture() {
  const state = { enabled: true, hidden: false, visible: true, minimized: false, fullscreen: false, simpleFullscreen: false, ownerFocused: true, consoleFocused: false }
  const owner = Object.assign(new EventEmitter(), {
    isDestroyed: () => false, isVisible: () => state.visible, isMinimized: () => state.minimized,
    isFullScreen: () => state.fullscreen, isSimpleFullScreen: () => state.simpleFullscreen, isFocused: () => state.ownerFocused
  })
  let parent: BrowserWindow | null = null
  let visible = false
  let bounds = { x: 900, y: 700, width: 700, height: 400 }
  const consoleWindow = Object.assign(new EventEmitter(), {
    isDestroyed: () => false, isVisible: () => visible, isFocused: () => state.consoleFocused, getParentWindow: () => parent,
    getBounds: () => ({ ...bounds }), setBounds: vi.fn((value) => { bounds = { ...value } }),
    setParentWindow: vi.fn((value: BrowserWindow | null) => { parent = value; bounds = { ...bounds, x: 0, y: 0 } }),
    setAlwaysOnTop: vi.fn(), setVisibleOnAllWorkspaces: vi.fn(),
    hide: vi.fn(() => { visible = false }), showInactive: vi.fn(() => { visible = true })
  })
  const binding = bindBrowserDevtoolsWindow(owner as unknown as BrowserWindow, consoleWindow as unknown as BrowserWindow, () => state.enabled, () => state.hidden)
  binding.sync()
  return { state, owner, consoleWindow, binding }
}

it("keeps the console above its owner and hides/restores both windows together", () => {
  const { state, owner, consoleWindow, binding } = fixture()
  expect(consoleWindow.getParentWindow()).toBe(owner)
  expect(consoleWindow.isVisible()).toBe(true)
  expect(consoleWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(true, "floating")
  state.visible = false
  owner.emit("hide")
  expect(consoleWindow.isVisible()).toBe(false)
  expect(consoleWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(false, "floating")
  state.visible = true
  owner.emit("show")
  expect(consoleWindow.isVisible()).toBe(true)
  state.minimized = true
  owner.emit("minimize")
  expect(consoleWindow.isVisible()).toBe(false)
  state.minimized = false
  owner.emit("restore")
  expect(consoleWindow.isVisible()).toBe(true)
  expect(consoleWindow.setParentWindow).toHaveBeenCalledOnce()
  binding.dispose()
})

it("preserves user placement and stays floating in native and simple fullscreen", () => {
  const { state, owner, consoleWindow, binding } = fixture()
  const bounds = { x: 1200, y: 800, width: 600, height: 350 }
  consoleWindow.setBounds(bounds)
  consoleWindow.emit("move")
  state.fullscreen = true
  owner.emit("enter-full-screen")
  expect(consoleWindow.getParentWindow()).toBeNull()
  expect(consoleWindow.getBounds()).toEqual(bounds)
  expect(consoleWindow.isVisible()).toBe(true)
  if (process.platform === "darwin") expect(consoleWindow.setVisibleOnAllWorkspaces).toHaveBeenLastCalledWith(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  state.fullscreen = false
  owner.emit("leave-full-screen")
  expect(consoleWindow.getParentWindow()).toBe(owner)
  expect(consoleWindow.getBounds()).toEqual(bounds)
  state.simpleFullscreen = true
  owner.emit("resize")
  expect(consoleWindow.getParentWindow()).toBeNull()
  expect(consoleWindow.isVisible()).toBe(true)
  binding.dispose()
})

it.each([
  { enabled: true, fullscreen: false }, { enabled: false, fullscreen: false },
  { enabled: true, fullscreen: true }, { enabled: false, fullscreen: true }
])("restores the last position after switching apps: %j", ({ enabled, fullscreen }) => {
  vi.useFakeTimers()
  const { state, owner, consoleWindow, binding } = fixture()
  state.enabled = enabled
  state.fullscreen = fullscreen
  binding.sync()
  const bounds = { x: 1100, y: 750, width: 650, height: 420 }
  consoleWindow.setBounds(bounds)
  consoleWindow.emit("move")
  state.ownerFocused = false
  owner.emit("blur")
  vi.runAllTimers()
  expect(consoleWindow.isVisible()).toBe(false)
  expect(consoleWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(false, "floating")
  // Simulate the window manager changing a hidden window's position.
  consoleWindow.setBounds({ ...bounds, x: 0, y: 0 })
  state.ownerFocused = true
  owner.emit("focus")
  expect(consoleWindow.isVisible()).toBe(true)
  expect(consoleWindow.getBounds()).toEqual(bounds)
  expect(consoleWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(true, "floating")
  owner.emit("focus")
  expect(consoleWindow.isVisible()).toBe(true)
  binding.dispose()
})

it("keeps DevTools visible when focus moves between it and Vessel", () => {
  vi.useFakeTimers()
  const { state, owner, consoleWindow, binding } = fixture()
  state.ownerFocused = false
  owner.emit("blur")
  state.consoleFocused = true
  consoleWindow.emit("focus")
  vi.runAllTimers()
  expect(consoleWindow.hide).not.toHaveBeenCalled()
  state.consoleFocused = false
  consoleWindow.emit("blur")
  state.ownerFocused = true
  owner.emit("focus")
  vi.runAllTimers()
  expect(consoleWindow.hide).not.toHaveBeenCalled()
  expect(consoleWindow.isVisible()).toBe(true)
  binding.dispose()
})

it("does not reveal a hidden browser console and removes listeners and pending timers on close", () => {
  vi.useFakeTimers()
  const { state, owner, consoleWindow, binding } = fixture()
  state.hidden = true
  binding.sync()
  owner.emit("focus")
  owner.emit("restore")
  expect(consoleWindow.isVisible()).toBe(false)
  state.hidden = false
  binding.sync()
  expect(consoleWindow.isVisible()).toBe(true)
  owner.emit("blur")
  consoleWindow.emit("closed")
  expect(owner.eventNames()).toEqual([])
  expect(consoleWindow.eventNames()).toEqual([])
  expect(vi.getTimerCount()).toBe(0)
})
