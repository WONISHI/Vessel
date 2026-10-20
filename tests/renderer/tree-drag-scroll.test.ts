import { describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import {
  calculateDragScrollSpeed,
  useTreeDragAutoScroll
} from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/use-tree-drag-scroll"

describe("calculateDragScrollSpeed", () => {
  const top = 100
  const bottom = 500
  const threshold = 40
  const minSpeed = 2
  const maxSpeed = 14

  it("returns 0 when cursor is in the middle safe area", () => {
    // Middle of viewport: y = 300
    expect(calculateDragScrollSpeed(300, top, bottom, threshold, minSpeed, maxSpeed)).toBe(0)
    // Just above bottom threshold: y = 450
    expect(calculateDragScrollSpeed(450, top, bottom, threshold, minSpeed, maxSpeed)).toBe(0)
    // Just below top threshold: y = 150
    expect(calculateDragScrollSpeed(150, top, bottom, threshold, minSpeed, maxSpeed)).toBe(0)
  })

  it("returns negative speed when cursor is near top boundary", () => {
    // Exactly at top threshold (top + 40 = 140)
    const speedAtThreshold = calculateDragScrollSpeed(140, top, bottom, threshold, minSpeed, maxSpeed)
    expect(speedAtThreshold).toBe(-minSpeed)

    // Halfway into top threshold (y = 120)
    const speedHalfway = calculateDragScrollSpeed(120, top, bottom, threshold, minSpeed, maxSpeed)
    expect(speedHalfway).toBeLessThan(-minSpeed)
    expect(speedHalfway).toBeGreaterThan(-maxSpeed)

    // At top edge (y = 100)
    const speedAtEdge = calculateDragScrollSpeed(100, top, bottom, threshold, minSpeed, maxSpeed)
    expect(speedAtEdge).toBe(-maxSpeed)

    // Slightly above top edge (header zone: y = 80)
    const speedAboveEdge = calculateDragScrollSpeed(80, top, bottom, threshold, minSpeed, maxSpeed)
    expect(speedAboveEdge).toBe(-maxSpeed)
  })

  it("returns positive speed when cursor is near bottom boundary", () => {
    // Exactly at bottom threshold (bottom - 40 = 460)
    const speedAtThreshold = calculateDragScrollSpeed(460, top, bottom, threshold, minSpeed, maxSpeed)
    expect(speedAtThreshold).toBe(minSpeed)

    // Halfway into bottom threshold (y = 480)
    const speedHalfway = calculateDragScrollSpeed(480, top, bottom, threshold, minSpeed, maxSpeed)
    expect(speedHalfway).toBeGreaterThan(minSpeed)
    expect(speedHalfway).toBeLessThan(maxSpeed)

    // At bottom edge (y = 500)
    const speedAtEdge = calculateDragScrollSpeed(500, top, bottom, threshold, minSpeed, maxSpeed)
    expect(speedAtEdge).toBe(maxSpeed)

    // Slightly below bottom edge (y = 520)
    const speedBelowEdge = calculateDragScrollSpeed(520, top, bottom, threshold, minSpeed, maxSpeed)
    expect(speedBelowEdge).toBe(maxSpeed)
  })

  it("returns 0 when cursor is far beyond the boundary zones", () => {
    // Way above top (y = 20, which is > 60px above top = 100)
    expect(calculateDragScrollSpeed(20, top, bottom, threshold, minSpeed, maxSpeed)).toBe(0)

    // Way below bottom (y = 600, which is > 60px below bottom = 500)
    expect(calculateDragScrollSpeed(600, top, bottom, threshold, minSpeed, maxSpeed)).toBe(0)
  })

  it("handles zero or inverted viewport height safely", () => {
    expect(calculateDragScrollSpeed(100, 200, 100, threshold, minSpeed, maxSpeed)).toBe(0)
    expect(calculateDragScrollSpeed(100, 100, 100, threshold, minSpeed, maxSpeed)).toBe(0)
  })
})

describe("useTreeDragAutoScroll", () => {
  it("scrolls down when dragging near bottom boundary", () => {
    vi.useFakeTimers()
    const viewport = document.createElement("div")
    Object.defineProperty(viewport, "scrollTop", { value: 0, writable: true })
    Object.defineProperty(viewport, "scrollHeight", { value: 1000, writable: true })
    Object.defineProperty(viewport, "clientHeight", { value: 400, writable: true })
    viewport.getBoundingClientRect = () => ({
      top: 100,
      bottom: 500,
      left: 0,
      right: 250,
      width: 250,
      height: 400,
      x: 0,
      y: 100,
      toJSON: () => {}
    })

    const onHoverPath = vi.fn()
    const onDropRoot = vi.fn()

    const { unmount } = renderHook(() =>
      useTreeDragAutoScroll({
        viewport,
        onHoverPath,
        onDropRoot,
        threshold: 40,
        minSpeed: 4,
        maxSpeed: 16
      })
    )

    // Simulate dragover near bottom (y = 490)
    act(() => {
      const event = new Event("dragover", { bubbles: true, cancelable: true }) as any
      event.clientX = 100
      event.clientY = 490
      event.dataTransfer = { types: ["application/x-vessel-files"] }
      viewport.dispatchEvent(event)
    })

    // Advance animation frame timer
    act(() => {
      vi.advanceTimersByTime(50)
    })

    expect(viewport.scrollTop).toBeGreaterThan(0)

    // Stop drag with dragend
    act(() => {
      window.dispatchEvent(new Event("dragend"))
    })

    const scrollAfterStop = viewport.scrollTop

    // Check that scrolling has stopped
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(viewport.scrollTop).toBe(scrollAfterStop)

    unmount()
    vi.useRealTimers()
  })

  it("updates hover target when elementFromPoint is available", () => {
    vi.useFakeTimers()
    const viewport = document.createElement("div")
    Object.defineProperty(viewport, "scrollTop", { value: 0, writable: true })
    Object.defineProperty(viewport, "scrollHeight", { value: 1000, writable: true })
    Object.defineProperty(viewport, "clientHeight", { value: 400, writable: true })
    viewport.getBoundingClientRect = () => ({
      top: 100,
      bottom: 500,
      left: 0,
      right: 250,
      width: 250,
      height: 400,
      x: 0,
      y: 100,
      toJSON: () => {}
    })

    const hoveredRow = document.createElement("div")
    hoveredRow.dataset.nodePath = "/workspace/folder-target"
    document.elementFromPoint = vi.fn().mockReturnValue(hoveredRow)

    const onHoverPath = vi.fn()

    const { unmount } = renderHook(() =>
      useTreeDragAutoScroll({
        viewport,
        onHoverPath,
        threshold: 40,
        minSpeed: 4,
        maxSpeed: 16
      })
    )

    act(() => {
      const event = new Event("dragover", { bubbles: true, cancelable: true }) as any
      event.clientX = 100
      event.clientY = 490
      event.dataTransfer = { types: ["application/x-vessel-files"] }
      viewport.dispatchEvent(event)
    })

    act(() => {
      vi.advanceTimersByTime(50)
    })

    expect(onHoverPath).toHaveBeenCalledWith("/workspace/folder-target")

    unmount()
    vi.useRealTimers()
  })

  it("scrolls up when dragging near top boundary", () => {
    vi.useFakeTimers()
    const viewport = document.createElement("div")
    Object.defineProperty(viewport, "scrollTop", { value: 200, writable: true })
    Object.defineProperty(viewport, "scrollHeight", { value: 1000, writable: true })
    Object.defineProperty(viewport, "clientHeight", { value: 400, writable: true })
    viewport.getBoundingClientRect = () => ({
      top: 100,
      bottom: 500,
      left: 0,
      right: 250,
      width: 250,
      height: 400,
      x: 0,
      y: 100,
      toJSON: () => {}
    })

    const { unmount } = renderHook(() =>
      useTreeDragAutoScroll({
        viewport,
        threshold: 40,
        minSpeed: 4,
        maxSpeed: 16
      })
    )

    // Simulate dragover near top (y = 110)
    act(() => {
      const event = new Event("dragover", { bubbles: true, cancelable: true }) as any
      event.clientX = 100
      event.clientY = 110
      event.dataTransfer = { types: ["application/x-vessel-files"] }
      viewport.dispatchEvent(event)
    })

    // Advance animation frame timer
    act(() => {
      vi.advanceTimersByTime(50)
    })

    expect(viewport.scrollTop).toBeLessThan(200)

    unmount()
    vi.useRealTimers()
  })
})

