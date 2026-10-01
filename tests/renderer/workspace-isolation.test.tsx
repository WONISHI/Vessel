import React from "react"
import { webcrypto } from "node:crypto"
import { act, renderHook, waitFor, cleanup } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useWorkspaceController } from "../../src/renderer/src/pages/workspace/hooks/useWorkspaceController"
const navigate = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
it("keeps same-directory tabs and expanded folders separate between workspace and resources", async () => {
  vi.stubGlobal("crypto", webcrypto)
  const state = new Map<string, unknown>()
  Object.assign(window, { electronAPI: { getAppState: vi.fn(async (key: string) => state.get(key) || null), setAppState: vi.fn(async (key: string, value: unknown) => { state.set(key, value) }) } })
  const workspace = { name: "same", path: "/same", files: [] }
  const work = renderHook(() => useWorkspaceController(workspace))
  const resources = renderHook(() => useWorkspaceController(workspace, undefined, "resources"))
  await waitFor(() => expect([...state.keys()].filter(key => key.includes('-tabs:'))).toHaveLength(2))
  act(() => { resources.result.current.openWorkspaceFile({ name: "a.md", path: "/same/a.md" }); resources.result.current.expandDirectory("/same/sub") })
  expect(navigate).toHaveBeenLastCalledWith("/resources/file")
  expect(work.result.current.openFiles).toHaveLength(0)
  expect(work.result.current.expandedFolders).toHaveLength(0)
  resources.unmount()
  const restored = renderHook(() => useWorkspaceController(workspace, undefined, "resources"))
  await waitFor(() => expect(restored.result.current.activeFilePath).toBe("/same/a.md"))
  expect(restored.result.current.expandedFolders).toEqual(["/same/sub"])
})
