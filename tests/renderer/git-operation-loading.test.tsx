import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { GitOperationLoading } from "@/pages/git/components/operation-loading"

afterEach(() => { cleanup(); vi.useRealTimers() })

it("shows the current operation, branch and elapsed time without inventing transfer progress", () => {
  vi.useFakeTimers()
  const { unmount } = render(<GitOperationLoading operation="push" branch="feature/ui" />)
  expect(screen.getByRole("status").textContent).toContain("正在推送")
  expect(screen.getByText("feature/ui")).toBeTruthy()
  expect(screen.getByText("已等待 0 秒")).toBeTruthy()
  act(() => vi.advanceTimersByTime(11000))
  expect(screen.getByText("已等待 11 秒")).toBeTruthy()
  expect(screen.getByText("远端响应较慢，请耐心等待")).toBeTruthy()
  expect(screen.queryByText(/\d+%/)).toBeNull()
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it("resets elapsed time when the remote operation changes", () => {
  vi.useFakeTimers()
  const view = render(<GitOperationLoading operation="pull" branch="main" />)
  expect(screen.getByText("正在拉取…")).toBeTruthy()
  act(() => vi.advanceTimersByTime(3000))
  view.rerender(<GitOperationLoading operation="fetch" branch="main" />)
  expect(screen.getByText("正在抓取…")).toBeTruthy()
  expect(screen.getByText("已等待 0 秒")).toBeTruthy()
})
