import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { HistoryLoadMore } from "@/pages/git/components/history-load-more"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("observes the ScrollArea viewport and loads near the end", () => {
  let notify: (entries: { isIntersecting: boolean }[]) => void = () => {}
  const observe = vi.fn(), disconnect = vi.fn(), load = vi.fn()
  const observer = vi.fn(function (callback, options) { notify = callback; expect(options.rootMargin).toContain("320px"); return { observe, disconnect } })
  vi.stubGlobal("IntersectionObserver", observer)
  const { unmount } = render(<div data-radix-scroll-area-viewport=""><HistoryLoadMore loaded={150} total={300} loading={false} failed={false} paused={false} onLoad={load} /></div>)
  expect(observer.mock.calls[0][1].root).not.toBeNull()
  notify([{ isIntersecting: false }]); expect(load).not.toHaveBeenCalled()
  notify([{ isIntersecting: true }]); expect(load).toHaveBeenCalledTimes(1)
  unmount(); expect(disconnect).toHaveBeenCalled()
})

it("stops automatic retries on failure and allows manual retry", () => {
  const observer = vi.fn(), load = vi.fn()
  vi.stubGlobal("IntersectionObserver", observer)
  render(<HistoryLoadMore loaded={150} total={300} loading={false} failed paused={false} onLoad={load} />)
  expect(observer).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "加载失败，点击重试" }))
  expect(load).toHaveBeenCalledTimes(1)
})
