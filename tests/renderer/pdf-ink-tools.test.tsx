import { render, fireEvent, cleanup } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { LazyPage } from "@/components/pdf-document/components/lazy-page"
vi.mock("react-pdf", () => ({ Page: () => null }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("draws on the top annotation layer and erases using a wider hit target", () => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} })
  const add = vi.fn(), erase = vi.fn()
  const props = { number: 1, width: 600, strokes: [], tool: "pen", color: "#e11d48", penWidth: 3, add, erase }
  const view = render(<LazyPage {...props} />)
  const svg = view.getByLabelText("PDF 笔迹层")
  Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() })
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 600, height: 848 } as DOMRect)
  const pointer = (type: string, x: number, y: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { clientX: x, clientY: y, button: 0, pointerId: 1 })
    fireEvent(svg, event)
  }
  pointer("pointerdown", 20, 30)
  pointer("pointermove", 100, 120)
  pointer("pointerup", 100, 120)
  expect(add).toHaveBeenCalledOnce()
  expect(add.mock.calls[0][0].points).toHaveLength(2)
  expect((svg as SVGElement).style.zIndex).toBe("10")
  view.rerender(<LazyPage {...props} tool="erase" strokes={[add.mock.calls[0][0]]} />)
  const hit = svg.querySelector('polyline[stroke="transparent"]')!
  expect(Number(hit.getAttribute("stroke-width"))).toBeGreaterThan(3)
  fireEvent.pointerDown(hit)
  expect(erase).toHaveBeenCalledWith(add.mock.calls[0][0].id)
  view.rerender(<LazyPage {...props} tool="view" />)
  expect((svg as SVGElement).style.pointerEvents).toBe("none")
})
