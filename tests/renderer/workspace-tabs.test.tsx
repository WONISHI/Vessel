import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useWorkspaceController } from "@/components/workspace/hooks/useWorkspaceController"
import { webcrypto } from "node:crypto"
const navigate = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }))

afterEach(cleanup)
beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true })
  window.electronAPI = { getAppState: vi.fn().mockResolvedValue(null), setAppState: vi.fn().mockResolvedValue(undefined) } as unknown as Window["electronAPI"]
})
it("closes several tabs atomically and returns home when all are closed", () => {
  const { result } = renderHook(() => useWorkspaceController({ name: "test", path: "/test", files: [] }))
  for (const name of ["a.md", "b.md", "c.md"]) {
    act(() => result.current.openWorkspaceFile({ name, path: "/test/" + name, type: "file" }))
  }
  act(() => result.current.closeWorkspaceFiles(["/test/a.md", "/test/b.md"]))
  expect(result.current.openFiles.map((file) => file.name)).toEqual(["c.md"])
  expect(result.current.activeFilePath).toBe("/test/c.md")
  act(() => result.current.closeWorkspaceFiles(["/test/c.md"]))
  expect(result.current.openFiles).toEqual([])
  expect(result.current.activeFilePath).toBe("")
  expect(navigate).toHaveBeenLastCalledWith("/editor")
})

it("restores file order and selection before saving, and restores after remount", async () => {
  const files = [
    { name: "a.md", path: "/test/a.md" },
    { name: "photo.webp", path: "/test/photo.webp" }
  ]
  let saved = { files, active: files[1].path }
  let release!: (value: typeof saved) => void
  vi.mocked(window.electronAPI.getAppState).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve
      })
  )
  vi.mocked(window.electronAPI.setAppState).mockImplementation(async (key, value) => {
    if (key.startsWith("workspace-tabs:")) saved = value as typeof saved
  })
  const first = renderHook(() => useWorkspaceController({ name: "test", path: "/test", files: [] }))
  await waitFor(() => expect(release).toBeDefined())
  expect(window.electronAPI.setAppState).not.toHaveBeenCalled()
  await act(async () => release(saved))
  await waitFor(() => expect(first.result.current.openFiles).toEqual(files))
  expect(first.result.current.activeFilePath).toBe(files[1].path)
  act(() => first.result.current.closeWorkspaceFile(files[0].path))
  await waitFor(() => expect(saved.files).toHaveLength(1))
  first.unmount()
  vi.mocked(window.electronAPI.getAppState).mockResolvedValue(saved)
  const next = renderHook(() => useWorkspaceController({ name: "test", path: "/test", files: [] }))
  await waitFor(() => expect(next.result.current.openFiles.map((file) => file.name)).toEqual(["photo.webp"]))
  expect(next.result.current.activeFilePath).toBe(files[1].path)
  next.unmount()
})

it("provides current workspace tabs and navigation to the file finder but excludes preview workspaces", () => {
  const { result } = renderHook(() => useWorkspaceController({ name: "test", path: "/test", files: [] }))
  renderHook(() => useWorkspaceController({ name: "preview", path: "/preview", files: [] }, undefined, "resources", true))
  act(() => result.current.openWorkspaceFile({ name: "a.md", path: "/test/a.md", type: "file" }))
  const receive = vi.fn()
  act(() => window.dispatchEvent(new CustomEvent("vessel:request-workspace-files", { detail: receive })))
  expect(receive).toHaveBeenCalledTimes(1)
  const snapshot = receive.mock.calls[0][0]
  expect(snapshot.root).toBe("/test")
  expect(snapshot.files.map((file: { path: string }) => file.path)).toEqual(["/test/a.md"])
  act(() => snapshot.openFile({ name: "b.md", path: "/test/b.md", type: "file" }))
  expect(result.current.activeFilePath).toBe("/test/b.md")
})
