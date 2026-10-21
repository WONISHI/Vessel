import { act, renderHook } from "@testing-library/react"
import { useSystemInfo } from "@/pages/debug/system-info/use-system-info"
import { afterEach, expect, it, vi } from "vitest"

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it("retries bridge errors, reacts to network and resize, and cleans up", async () => {
  vi.useFakeTimers()
  vi.spyOn(document, "hidden", "get").mockReturnValue(false)
  const snapshot = { platform: "darwin", storageBytes: 1024 }
  const getSystemInfo = vi.fn().mockRejectedValueOnce(new Error("offline bridge")).mockResolvedValue(snapshot)
  vi.stubGlobal("electronAPI", { getSystemInfo })
  const { result, unmount } = renderHook(() => useSystemInfo())
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(result.current.error).toBe("offline bridge")
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(result.current.info).toEqual(snapshot)
  expect(result.current.error).toBe("")
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
  vi.stubGlobal("innerWidth", 900)
  await act(async () => {
    window.dispatchEvent(new Event("offline"))
    window.dispatchEvent(new Event("resize"))
  })
  expect(result.current.windowInfo).toMatchObject({ online: false, width: 900 })
  unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(getSystemInfo).toHaveBeenCalledTimes(2)
})
