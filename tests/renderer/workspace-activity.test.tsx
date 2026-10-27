import { act, renderHook, waitFor, cleanup } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { webcrypto } from "node:crypto"
import { useWorkspaceActivityTracker } from "@/components/workspace/hooks/useWorkspaceActivity"
const listeners = vi.hoisted(() => ({ current: undefined as Function | undefined }))
vi.mock("@/components/workspace/hooks/file-changes", () => ({ useFileChanges: (callback: Function) => { listeners.current = callback } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("backfills deeply nested edits despite existing history and keeps recording away from home", async () => {
  vi.stubGlobal("crypto", webcrypto)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`
  const save = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = {
    ...window.electronAPI,
    getAppState: vi.fn().mockResolvedValue({ "2026-01-01": { date: "2026-01-01", create: 1, update: 5, delete: 2 } }),
    setAppState: save,
    readWorkspaceDirectory: vi.fn(async (_root, path) => {
      if (path === "/notes") return [{ type: "directory", name: "a", path: "/notes/a" }]
      if (path === "/notes/a") return [{ type: "directory", name: "b", path: "/notes/a/b" }]
      return [{ type: "file", name: "note.md", path: "/notes/a/b/note.md", mtime: yesterday.getTime() }]
    })
  } as any
  const { result } = renderHook(() => useWorkspaceActivityTracker("/notes"))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.activityMap.get(date)?.update).toBe(1)
  const yesterdayTrend = result.current.monthlyData.find((day) => day.fullDate === date)!
  expect(yesterdayTrend.修改).toBe(1)
  expect(yesterdayTrend.总计).toBe(result.current.calendarData.find((day) => day.date === date)?.count)
  expect(save.mock.calls[0][1]["2026-01-01"].update).toBe(5)
  act(() => listeners.current!([{ path: "/other/note.md", type: "update" }]))
  expect(save).toHaveBeenCalledTimes(1)
  act(() => listeners.current!([{ path: "/notes/a/b/note.md", type: "update" }]))
  expect(save).toHaveBeenCalledTimes(2)
  const todayTrend = result.current.monthlyData.at(-1)!
  expect(todayTrend.修改).toBe(1)
  expect(todayTrend.总计).toBe(result.current.calendarData.at(-1)?.count)
})
