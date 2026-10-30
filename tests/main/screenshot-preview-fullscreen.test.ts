import { EventEmitter } from "node:events"
import { expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ window: null as any }))
vi.mock("electron", () => ({ BrowserWindow: { fromWebContents: () => state.window } }))
import { fullscreenPreviewWindow } from "@main/screenshot/preview-fullscreen"

it("waits for native fullscreen and renderer paint before allowing capture", async () => {
  const order: string[] = []
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false, isFullScreen: () => false,
    show: vi.fn(), focus: vi.fn(),
    setFullScreen: vi.fn(() => { order.push("request-fullscreen") }),
    getBounds: () => ({ x: 0, y: 0, width: 1920, height: 1080 })
  })
  state.window = window
  const source = { executeJavaScript: vi.fn(async () => { order.push("paint") }) }
  const ready = fullscreenPreviewWindow(source as any).then(() => order.push("capture"))
  expect(order).toEqual(["request-fullscreen"])
  window.emit("enter-full-screen")
  await ready
  expect(order).toEqual(["request-fullscreen", "paint", "capture"])
  expect(window.listenerCount("closed")).toBe(0)
})

it("retains an already fullscreen window and only waits for paint", async () => {
  state.window = { isDestroyed: () => false, isFullScreen: () => true, show: vi.fn(), focus: vi.fn(), getBounds: () => ({ width: 1920, height: 1080 }) }
  const source = { executeJavaScript: vi.fn(async () => {}) }
  expect(await fullscreenPreviewWindow(source as any)).toEqual({ width: 1920, height: 1080 })
  expect(source.executeJavaScript).toHaveBeenCalledOnce()
})
