import { act, cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { FileThemeIcon } from "@/features/file-icons"
import { FileIconScope, setFileIconSettings } from "@/features/file-icons/state"
import { resolveFileIcon } from "@/features/file-icons/resolve"

vi.mock("@/features/file-icons/resolve", async importOriginal => {
  const actual = await importOriginal<typeof import("@/features/file-icons/resolve")>()
  return { ...actual, resolveFileIcon: vi.fn(actual.resolveFileIcon) }
})
afterEach(() => { cleanup(); setFileIconSettings({}); vi.clearAllMocks() })

it("reuses resource icons on selection updates but refreshes folder, path and theme changes", () => {
  setFileIconSettings({ fileIconTheme: "material" })
  const icon = (selected: boolean, expanded: boolean, name = "/project/src") => (
    <FileIconScope.Provider value="resources">
      <div data-selected={selected}>
        <FileThemeIcon name={name} directory expanded={expanded} fallback={<span>folder</span>} />
      </div>
    </FileIconScope.Provider>
  )
  const view = render(icon(false, false))
  expect(resolveFileIcon).toHaveBeenCalledTimes(1)
  expect(view.container.querySelector("img")?.src).toContain("/material/folder-src.svg")
  view.rerender(icon(true, false))
  expect(resolveFileIcon).toHaveBeenCalledTimes(1)
  view.rerender(icon(true, true))
  expect(resolveFileIcon).toHaveBeenCalledTimes(2)
  expect(view.container.querySelector("img")?.src).toContain("/material/folder-src-open.svg")
  view.rerender(icon(true, true, "/project/docs"))
  expect(resolveFileIcon).toHaveBeenCalledTimes(3)
  act(() => setFileIconSettings({ fileIconTheme: "symbols" }))
  expect(resolveFileIcon).toHaveBeenCalledTimes(4)
  expect(view.container.querySelector("img")?.dataset.fileIconTheme).toBe("symbols")
})
