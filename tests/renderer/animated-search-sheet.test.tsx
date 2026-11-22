import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { AnimatedSearchSheet } from "@/pages/search/components/animated-search-sheet"
const animationEnd = (node: Element) => {
  for (const name of ["animationend", "webkitAnimationEnd"]) {
    const event = new Event(name, { bubbles: true })
    Object.defineProperty(event, "animationName", { value: "vessel-search-out" })
    fireEvent(node, event)
  }
}
vi.mock("@/pages/search/components/search-panel", () => ({ SearchPanel: ({ onClose }: { onClose?: () => void }) => <button onClick={onClose}>关闭搜索</button> }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it("keeps search controls mounted until the sheet's own exit animation ends", () => {
  const closed = vi.fn()
  render(<AnimatedSearchSheet onClose={closed} onSelect={vi.fn()} />)
  const sheet = screen.getByRole("region", { name: "工作区全文搜索" })
  expect(sheet.dataset.state).toBe("open")
  fireEvent.click(screen.getByText("关闭搜索"))
  expect(sheet.dataset.state).toBe("closed")
  expect(closed).not.toHaveBeenCalled()
  animationEnd(screen.getByText("关闭搜索"))
  expect(closed).not.toHaveBeenCalled()
  animationEnd(sheet)
  expect(closed).toHaveBeenCalledOnce()
})

it("closes immediately with reduced motion", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }))
  const closed = vi.fn()
  render(<AnimatedSearchSheet onClose={closed} onSelect={vi.fn()} />)
  fireEvent.click(screen.getByText("关闭搜索"))
  expect(closed).toHaveBeenCalledOnce()
})
