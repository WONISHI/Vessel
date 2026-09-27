import { act, renderHook } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { useWorkspaceController } from "../../src/renderer/src/pages/workspace/hooks/useWorkspaceController"
const navigate = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }))

it("closes several tabs atomically and returns home when all are closed", () => {
  const { result } = renderHook(() => useWorkspaceController({ name: "test", path: "/test", files: [] }))
  for (const name of ["a.md", "b.md", "c.md"]) {
    act(() => result.current.openWorkspaceFile({ name, path: "/test/" + name, type: "file" }))
  }
  act(() => result.current.closeWorkspaceFiles(["/test/a.md", "/test/b.md"]))
  expect(result.current.openFiles.map(file => file.name)).toEqual(["c.md"])
  expect(result.current.activeFilePath).toBe("/test/c.md")
  act(() => result.current.closeWorkspaceFiles(["/test/c.md"]))
  expect(result.current.openFiles).toEqual([])
  expect(result.current.activeFilePath).toBe("")
  expect(navigate).toHaveBeenLastCalledWith("/editor")
})
