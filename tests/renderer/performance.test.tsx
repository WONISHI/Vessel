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

it("retains sampled content and history when revisiting while the next sample is pending", async () => {
  const snapshot = { sampledAt: 2000, cpuPercent: 12, memoryBytes: 2048, systemMemoryBytes: 8192, processes: [] }
  const getPerformanceSnapshot = vi.fn().mockResolvedValueOnce(snapshot)
  vi.stubGlobal("electronAPI", { getPerformanceSnapshot })
  vi.spyOn(document, "hidden", "get").mockReturnValue(false)
  const first = renderHook(() => usePerformance())
  await waitFor(() => expect(first.result.current.snapshot).toEqual(snapshot))
  const previousHistory = first.result.current.history
  first.unmount()
  let resolve!: (value: typeof snapshot) => void
  getPerformanceSnapshot.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const second = renderHook(() => usePerformance())
  expect(second.result.current.snapshot).toEqual(snapshot)
  expect(second.result.current.history).toEqual(previousHistory)
  await act(async () => { resolve({ ...snapshot, sampledAt: 3000, memoryBytes: 4096 }) })
  expect(second.result.current.snapshot?.memoryBytes).toBe(4096)
  expect(second.result.current.history).toHaveLength(previousHistory.length + 1)
  second.unmount()
})
