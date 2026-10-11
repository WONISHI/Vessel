// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useDraggable } from "../../src/renderer/src/components/core/devtool/hooks/useDraggable"
afterEach(() => vi.useRealTimers())
it("keeps short clicks, moves only after a hold, and suppresses the drag click", () => {
  vi.useFakeTimers()
  const { result, unmount } = renderHook(() => useDraggable())
  const element = document.createElement("button")
  element.setPointerCapture = vi.fn(); element.hasPointerCapture = () => true; element.releasePointerCapture = vi.fn()
  element.getBoundingClientRect = () => ({ left: 100, top: 100, width: 48, height: 48 }) as DOMRect
  const down = () => result.current.handlePointerDown({ button: 0, pointerId: 1, clientX: 110, clientY: 110, currentTarget: element, preventDefault() {} } as never)
  act(() => { down(); window.dispatchEvent(new Event("pointerup")) })
  expect(result.current.consumeDragClick()).toBe(false)
  act(() => { down(); vi.advanceTimersByTime(350) })
  expect(result.current.dragging).toBe(true)
  act(() => {
    const move = new Event("pointermove", { cancelable: true })
    Object.assign(move, { pointerId: 1, clientX: 210, clientY: 180 })
    window.dispatchEvent(move)
    window.dispatchEvent(new Event("pointerup"))
  })
  expect(result.current.position).toEqual({ x: 200, y: 170 })
  expect(result.current.consumeDragClick()).toBe(true)
  expect(result.current.consumeDragClick()).toBe(false)
  expect(result.current.dragging).toBe(false)
  expect(document.head.textContent).not.toContain("pointer-events:none")
  unmount()
})
