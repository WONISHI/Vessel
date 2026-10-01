import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useExternalContent } from "../../src/renderer/src/pages/workspace/hooks/file-changes"
afterEach(cleanup)
const change = () => window.dispatchEvent(new CustomEvent("vessel:files-changed", { detail: [{ path: "/note.md", type: "update" }] }))
it("updates external content but does not reload a self-save", async () => {
  const apply = vi.fn()
  Object.assign(window, { electronAPI: { readContent: vi.fn().mockResolvedValue("same") } })
  renderHook(() => useExternalContent("/note.md", "same", apply))
  await act(async () => { change() })
  expect(apply).not.toHaveBeenCalled()
  vi.mocked(window.electronAPI.readContent).mockResolvedValue("external")
  await act(async () => { change() })
  await waitFor(() => expect(apply).toHaveBeenCalledWith("external"))
})
it("does not overwrite edits made while an external read is pending", async () => {
  const apply = vi.fn()
  let resolve!: (value: string) => void
  Object.assign(window, { electronAPI: { readContent: vi.fn(() => new Promise<string>(done => { resolve = done })) } })
  const hook = renderHook(({ content }) => useExternalContent("/note.md", content, apply), { initialProps: { content: "old" } })
  act(change)
  hook.rerender({ content: "new local edit" })
  await act(async () => { resolve("external") })
  expect(apply).not.toHaveBeenCalled()
})
