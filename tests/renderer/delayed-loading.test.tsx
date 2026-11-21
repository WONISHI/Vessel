import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useDelayedLoading } from "@/hooks/use-delayed-loading"

afterEach(() => { cleanup(); vi.useRealTimers() })
it("keeps fast reads spinner-free and delays each new loading cycle independently", () => {
  vi.useFakeTimers()
  const view = renderHook(({ loading }) => useDelayedLoading(loading), { initialProps: { loading: true } })
  expect(view.result.current).toBe(false)
  act(() => vi.advanceTimersByTime(100))
  view.rerender({ loading: false })
  act(() => vi.advanceTimersByTime(200))
  expect(view.result.current).toBe(false)
  view.rerender({ loading: true })
  expect(view.result.current).toBe(false)
  act(() => vi.advanceTimersByTime(180))
  expect(view.result.current).toBe(true)
  view.rerender({ loading: false })
  expect(view.result.current).toBe(false)
  view.rerender({ loading: true })
  expect(view.result.current).toBe(false)
})
