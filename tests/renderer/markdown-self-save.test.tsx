import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useExternalContent } from "@/components/workspace/hooks/file-changes"
import { saveMarkdownContent, waitForMarkdownWrites } from "@/components/core/canvas/variants/markdown/local-writes"
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("waits for focus-line saves before reading watcher updates instead of reloading transient content", async () => {
  let disk = "four images"
  const writes: Array<() => void> = []
  const read = vi.fn(async () => disk)
  vi.stubGlobal("electronAPI", undefined)
  Object.defineProperty(window, "electronAPI", { configurable: true, value: {
    saveContent: vi.fn((_path: string, content: string) => new Promise<void>((resolve) => writes.push(() => { disk = content; resolve() }))),
    readContent: read
  } })
  const apply = vi.fn()
  const path = "/w/note.md"
  const hook = renderHook(({ content }) => useExternalContent(path, content, apply, waitForMarkdownWrites), { initialProps: { content: disk } })
  const first = saveMarkdownContent(path, "first focus line")
  const last = saveMarkdownContent(path, "final focus line")
  hook.rerender({ content: "final focus line" })
  act(() => window.dispatchEvent(new CustomEvent("vessel:files-changed", { detail: [{ path, type: "update" }] })))
  await act(async () => { writes[0](); await first })
  expect(read).not.toHaveBeenCalled()
  expect(apply).not.toHaveBeenCalled()
  await act(async () => { writes[1](); await last })
  await waitFor(() => expect(read).toHaveBeenCalledOnce())
  expect(apply).not.toHaveBeenCalled()
  disk = "external edit"
  act(() => window.dispatchEvent(new CustomEvent("vessel:files-changed", { detail: [{ path, type: "update" }] })))
  await waitFor(() => expect(apply).toHaveBeenCalledExactlyOnceWith("external edit"))
})
