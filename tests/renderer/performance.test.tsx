import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { usePerformance } from "@/pages/debug/performance/use-performance"

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it("polls real bridge snapshots, retries failures and stops on unmount", async () => {
  const snapshot = { sampledAt: 1000, cpuPercent: 12, memoryBytes: 1024, systemMemoryBytes: 4096, processes: [] }
  const getPerformanceSnapshot = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(snapshot)
  vi.stubGlobal("electronAPI", { getPerformanceSnapshot })
  vi.spyOn(document, "hidden", "get").mockReturnValue(false)
  const cancel = vi.spyOn(window, "cancelAnimationFrame")
  const { result, unmount } = renderHook(() => usePerformance())
  await waitFor(() => expect(result.current.error).toBe("offline"))
  await waitFor(() => expect(result.current.snapshot).toEqual(snapshot), { timeout: 2000 })
  expect(result.current.error).toBe("")
  vi.useFakeTimers()
  unmount()
  const calls = getPerformanceSnapshot.mock.calls.length
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
  expect(getPerformanceSnapshot).toHaveBeenCalledTimes(calls)
  expect(cancel).toHaveBeenCalled()
})

it("does not sample a hidden page and resumes when visible", async () => {
  vi.useFakeTimers()
  let hidden = true
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden)
  const getPerformanceSnapshot = vi.fn().mockResolvedValue({ processes: [] })
  vi.stubGlobal("electronAPI", { getPerformanceSnapshot })
  const { result, unmount } = renderHook(() => usePerformance())
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(getPerformanceSnapshot).not.toHaveBeenCalled()
  hidden = false
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")) })
  expect(result.current.visible).toBe(true)
  expect(getPerformanceSnapshot).toHaveBeenCalledTimes(1)
  hidden = true
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(2000)
  })
  expect(result.current.fps).toBeNull()
  expect(getPerformanceSnapshot).toHaveBeenCalledTimes(1)
  unmount()
})
