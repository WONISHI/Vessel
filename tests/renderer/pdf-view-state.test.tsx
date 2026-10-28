import { fireEvent, render, cleanup } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { usePdfViewState } from "@/components/pdf-document/components/view-state"
afterEach(cleanup)
function Preview({ id, ready = true }: { id: string; ready?: boolean }) {
  const { viewport, zoom, setZoom } = usePdfViewState(id, ready, 600)
  return <><button onClick={() => setZoom(1.5)}>{zoom}</button><div ref={viewport} data-testid="viewport" /></>
}
it("restores the same PDF's scroll and zoom after closing and reopening, without affecting another file", () => {
  const first = render(<Preview id="pdf-one" />)
  const viewport = first.getByTestId("viewport")
  viewport.scrollTop = 1200
  viewport.scrollLeft = 20
  fireEvent.scroll(viewport)
  fireEvent.click(first.getByRole("button"))
  first.unmount()
  const other = render(<Preview id="pdf-two" />)
  expect(other.getByTestId("viewport").scrollTop).toBe(0)
  other.unmount()
  const reopened = render(<Preview id="pdf-one" ready={false} />)
  reopened.rerender(<Preview id="pdf-one" />)
  expect(reopened.getByTestId("viewport").scrollTop).toBe(1200)
  expect(reopened.getByTestId("viewport").scrollLeft).toBe(20)
  expect(reopened.getByRole("button").textContent).toBe("1.5")
})
