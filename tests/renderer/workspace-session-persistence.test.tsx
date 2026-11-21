import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useWorkspaceSessionPersistence } from "@/components/workspace/hooks/use-workspace-session-persistence"

const files = [{ name: "index.ts", path: "/w/index.ts" }]
afterEach(cleanup)

it("publishes tabs and folder state to the memory store without database writes", () => {
  const save = vi.fn().mockResolvedValue(undefined)
  const database = vi.fn()
  window.electronAPI = { setWorkspaceSession: save, setAppState: database } as any
  const { rerender } = renderHook(({ active, expanded }) => useWorkspaceSessionPersistence("workspace-tabs:w", files, active, expanded), { initialProps: { active: "", expanded: [] as string[] } })
  rerender({ active: "/w/index.ts", expanded: ["/w/src"] })
  expect(save).toHaveBeenLastCalledWith("workspace-tabs:w", { files, active: "/w/index.ts", expanded: ["/w/src"] })
  expect(database).not.toHaveBeenCalled()
})

it("does not save before session restoration or delay the last update until unmount", () => {
  const save = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = { setWorkspaceSession: save } as any
  const expanded = ["/w/src"]
  const { rerender, unmount } = renderHook(({ session }) => useWorkspaceSessionPersistence(session, files, "", expanded), { initialProps: { session: "" } })
  expect(save).not.toHaveBeenCalled()
  rerender({ session: "first" })
  expect(save).toHaveBeenCalledExactlyOnceWith("first", { files, active: "", expanded })
  rerender({ session: "second" })
  expect(save).toHaveBeenLastCalledWith("second", { files, active: "", expanded })
  unmount()
  expect(save).toHaveBeenCalledTimes(2)
})
