import { EventEmitter } from "node:events"
import type { BrowserWindow } from "electron"
import { expect, it, vi } from "vitest"
import { bindBrowserDevtoolsWindow } from "../../src/main/browser/browser-devtools-window"

function fixture() {
  const state = { enabled: true, hidden: false, visible: true, minimized: false, fullscreen: false, simpleFullscreen: false }
  const owner = Object.assign(new EventEmitter(), {
    isDestroyed: () => false, isVisible: () => state.visible, isMinimized: () => state.minimized,
    isFullScreen: () => state.fullscreen, isSimpleFullScreen: () => state.simpleFullscreen
  })
  let parent: BrowserWindow | null = null
  let visible = false
  const consoleWindow = Object.assign(new EventEmitter(), {
    isDestroyed: () => false, isVisible: () => visible, getParentWindow: () => parent,
    setParentWindow: vi.fn((value: BrowserWindow | null) => { parent = value }),
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
  state.visible = false
  owner.emit("hide")
  expect(consoleWindow.isVisible()).toBe(false)
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

it("detaches on fullscreen and when disabled, restoring the relationship on leaving fullscreen", () => {
  const { state, owner, consoleWindow, binding } = fixture()
  state.fullscreen = true
  owner.emit("enter-full-screen")
  expect(consoleWindow.getParentWindow()).toBeNull()
  state.fullscreen = false
  owner.emit("leave-full-screen")
  expect(consoleWindow.getParentWindow()).toBe(owner)
  state.simpleFullscreen = true
  owner.emit("resize")
  expect(consoleWindow.getParentWindow()).toBeNull()
  state.simpleFullscreen = false
  state.enabled = false
  binding.sync()
  state.visible = false
  owner.emit("hide")
  expect(consoleWindow.isVisible()).toBe(true)
  state.enabled = true
  binding.sync()
  expect(consoleWindow.getParentWindow()).toBe(owner)
  expect(consoleWindow.isVisible()).toBe(false)
  binding.dispose()
})

it("does not reveal a console from a hidden browser page and removes owner listeners on close", () => {
  const { state, owner, consoleWindow, binding } = fixture()
  state.hidden = true
  binding.sync()
  owner.emit("focus")
  owner.emit("restore")
  expect(consoleWindow.isVisible()).toBe(false)
  state.hidden = false
  binding.sync()
  expect(consoleWindow.isVisible()).toBe(true)
  consoleWindow.emit("closed")
  expect(owner.eventNames()).toEqual([])
  expect(consoleWindow.listenerCount("closed")).toBe(0)
})
