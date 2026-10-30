import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { VirtualTree } from "@/components/ui/tree"
import { virtualTreeRange } from "@/components/ui/tree/components/virtual-range"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
/** Creates a measurable viewport without depending on jsdom layout. */
function viewportFixture() {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} })
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
    expect(screen.getAllByRole("treeitem").length).toBeLessThanOrEqual(32)
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
it("clamps buffers after a directory collapses and covers fractional rows", () => {
  expect(virtualTreeRange(96000, 320, 5, 32, 6)).toEqual({ start: 0, end: 5 })
  expect(virtualTreeRange(321, 320, 10000, 32, 6)).toEqual({ start: 0, end: 31 })
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
  expect(screen.getAllByRole("treeitem").length).toBeLessThanOrEqual(32)
})
