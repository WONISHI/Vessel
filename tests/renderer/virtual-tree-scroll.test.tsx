import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { VirtualTree } from "@/components/ui/tree"
import { virtualTreeRange } from "@/components/ui/tree/components/virtual-range"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
/** Creates a measurable viewport without depending on jsdom layout. */
function viewportFixture() {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn() })
  const viewport = document.createElement("div")
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 320 })
  document.body.append(viewport)
  return viewport
}
it("commits visible rows inside the scroll event even after a distant scrollbar jump", () => {
  const viewport = viewportFixture()
  const rows = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), depth: 0, item: index }))
  render(<VirtualTree rows={rows} viewport={viewport} renderRow={(row) => <span>文件{row.item}</span>} />, { container: viewport })
  for (const top of [96000, 128, 250000, 0]) {
    act(() => {
      viewport.scrollTop = top
      viewport.dispatchEvent(new Event("scroll"))
      expect(screen.getByText(`文件${Math.floor(top / 32)}`)).toBeTruthy()
    })
    expect(screen.getAllByRole("treeitem").length).toBeLessThanOrEqual(112)
  }
})
it("keeps buffered rows mounted and skips rerendering on small scroll movements", () => {
  const viewport = viewportFixture()
  const rows = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), depth: 0, item: index }))
  const renderer = vi.fn((row) => <span>文件{row.item}</span>)
  render(<VirtualTree rows={rows} viewport={viewport} renderRow={renderer} />, { container: viewport })
  const first = screen.getByText("文件0")
  renderer.mockClear()
  act(() => { viewport.scrollTop = 32; viewport.dispatchEvent(new Event("scroll")) })
  expect(renderer).not.toHaveBeenCalled()
  expect(screen.getByText("文件0")).toBe(first)
  act(() => { viewport.scrollTop = 320; viewport.dispatchEvent(new Event("scroll")) })
  expect(screen.getByText("文件0")).toBe(first)
  expect(renderer.mock.calls.length).toBeLessThanOrEqual(10)
})

it("batches rapid buffer refills into one frame and cancels queued work when unmounted", () => {
  const viewport = viewportFixture()
  const frames = new Map<number, FrameRequestCallback>()
  let sequence = 0
  const request = vi.fn((callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence })
  const cancel = vi.fn((id: number) => { frames.delete(id) })
  vi.stubGlobal("requestAnimationFrame", request)
  vi.stubGlobal("cancelAnimationFrame", cancel)
  const rows = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), depth: 0, item: index }))
  const renderer = vi.fn(row => <span>缓冲文件{row.item}</span>)
  const view = render(<VirtualTree rows={rows} viewport={viewport} renderRow={renderer} />, { container: viewport })
  renderer.mockClear()
  act(() => {
    for (const top of [352, 384, 416, 448, 480]) {
      viewport.scrollTop = top
      viewport.dispatchEvent(new Event("scroll"))
    }
  })
  expect(request).toHaveBeenCalledOnce()
  expect(renderer).not.toHaveBeenCalled()
  expect(screen.getByText("缓冲文件15")).toBeTruthy()
  expect(screen.getByRole("tree").style.overflowAnchor).toBe("none")
  const callback = frames.values().next().value!
  frames.clear()
  act(() => callback(16))
  expect(renderer).toHaveBeenCalled()
  expect(viewport.scrollTop).toBe(480)
  act(() => { viewport.scrollTop = 2240; viewport.dispatchEvent(new Event("scroll")) })
  expect(frames.size).toBe(1)
  view.unmount()
  expect(cancel).toHaveBeenCalled()
  expect(frames.size).toBe(0)
})
it("clamps buffers after a directory collapses and covers fractional rows", () => {
  expect(virtualTreeRange(96000, 320, 5, 32, 6)).toEqual({ start: 0, end: 5 })
  expect(virtualTreeRange(321, 320, 10000, 32, 6)).toEqual({ start: 0, end: 41 })
  expect(virtualTreeRange(0, 320, 0, 32, 6)).toEqual({ start: 0, end: 0 })
})

it("refreshes a programmatic reveal before a native scroll event arrives", () => {
  const viewport = viewportFixture()
  const rows = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), depth: 0, item: index }))
  render(<VirtualTree rows={rows} viewport={viewport} renderRow={(row) => <span>文件{row.item}</span>} />, { container: viewport })
  act(() => {
    viewport.scrollTop = 240000
    viewport.dispatchEvent(new Event("vessel:tree-reveal"))
  })
  expect(screen.getByText("文件7500")).toBeTruthy()
  expect(screen.getAllByRole("treeitem").length).toBeLessThanOrEqual(52)
})

it("buffers several viewports in the scroll direction and caps a large jump", () => {
  const forward = virtualTreeRange(3200, 320, 10000, 32, 6, 1, 320)
  const backward = virtualTreeRange(3200, 320, 10000, 32, 6, -1, 320)
  expect(forward).toEqual({ start: 80, end: 160 })
  expect(backward).toEqual({ start: 50, end: 130 })
  const jump = virtualTreeRange(96000, 320, 10000, 32, 6, 1, 96000)
  expect(jump.end - jump.start).toBeLessThanOrEqual(110)
})

it.each(["pointerdown", "pointermove"])("fills a scrollbar destination on %s before a native scroll event is delivered", async (type) => {
  const area = document.createElement("div")
  area.dataset.vesselScroll = "area"
  document.body.append(area)
  const viewport = viewportFixture()
  const scrollbar = document.createElement("div")
  scrollbar.dataset.orientation = "vertical"
  area.append(viewport, scrollbar)
  const rows = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), depth: 0, item: index }))
  render(<VirtualTree rows={rows} viewport={viewport} renderRow={row => <span>拖动文件{row.item}</span>} />, { container: viewport })
  await act(async () => {
    scrollbar.dispatchEvent(new MouseEvent(type, { bubbles: true, buttons: 1 }))
    viewport.scrollTop = 192000
    await Promise.resolve()
    expect(screen.getByText("拖动文件6000")).toBeTruthy()
  })
  expect(screen.getAllByRole("treeitem").length).toBeLessThanOrEqual(112)
})
