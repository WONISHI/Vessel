import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { GitStatusResult } from "@vessel/type"
import { setFileIconSettings } from "@/features/file-icons/state"
import { GitFilePicker } from "@/pages/git/components/git-file-picker"
import { gitPickerEntries, GIT_FILE_PICKER_REQUEST, type GitPickerData } from "@/pages/git/file-picker-state"
import { useGitFilePicker } from "@/pages/git/hooks/use-git-file-picker"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

const status = { staged: [{ path: "src/services.ts", status: "M" }], unstaged: [{ path: "src/services.ts", status: "M" }], untracked: [{ path: "notes.md", status: "?" }], conflicts: [{ path: "merge.ts", status: "UU" }] } as unknown as GitStatusResult
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  HTMLElement.prototype.scrollTo = vi.fn()
})
afterEach(() => { cleanup(); setFileIconSettings({}); vi.unstubAllGlobals() })
it("keeps index and worktree versions separate and deduplicates worktree paths", () => {
  const entries = gitPickerEntries({ ...status, untracked: [...status.untracked, ...status.unstaged] })
  expect(entries.map(entry => [entry.section, entry.file.path])).toEqual([
    ["staged", "src/services.ts"], ["conflicts", "merge.ts"], ["unstaged", "src/services.ts"], ["unstaged", "notes.md"]
  ])
  expect(gitPickerEntries(null)).toEqual([])
})
it("filters changed paths and selects the correct worktree version by keyboard", () => {
  setFileIconSettings({ fileIconTheme: "material", fileIconWorkspace: false, fileIconResources: true })
  const select = vi.fn(), onClose = vi.fn()
  render(<GitFilePicker open data={{ repoPath: "/repo", entries: gitPickerEntries(status), select }} onClose={onClose} />)
  expect(document.querySelectorAll('img[data-file-icon-theme="material"]')).toHaveLength(4)
  const input = screen.getByLabelText("Git 变更文件关键词")
  fireEvent.change(input, { target: { value: "SRC services" } })
  expect(screen.queryByText("notes.md")).toBeNull()
  expect(screen.getAllByText("services.ts")).toHaveLength(2)
  fireEvent.keyDown(input, { key: "ArrowDown" })
  fireEvent.keyDown(input, { key: "Enter" })
  expect(select.mock.calls[0][0].section).toBe("unstaged")
  expect(onClose).toHaveBeenCalledOnce()
})
it("reveals a result in status view, clears its list filter, and selects its diff section", () => {
  const g = { repoPath: "/repo", status,
    ...Object.fromEntries(["setActiveTab", "setActiveFileSection", "setSelectedStagedPaths", "setSelectedUnstagedPaths", "setSelectedConflictPaths", "setStagedFileQuery", "setUnstagedFileQuery", "setSelectedFile"].map(key => [key, vi.fn()]))
  } as unknown as GitPageModel
  const { unmount } = renderHook(() => useGitFilePicker(g))
  let data: GitPickerData | undefined
  window.dispatchEvent(new CustomEvent(GIT_FILE_PICKER_REQUEST, { detail: (value: GitPickerData) => { data = value } }))
  data!.select(data!.entries[0])
  expect(g.setActiveTab).toHaveBeenCalledWith("status")
  expect(g.setActiveFileSection).toHaveBeenCalledWith("staged")
  expect(g.setSelectedStagedPaths).toHaveBeenCalledWith(["src/services.ts"])
  expect(g.setSelectedUnstagedPaths).toHaveBeenCalledWith([])
  expect(g.setStagedFileQuery).toHaveBeenCalledWith("")
  expect(g.setUnstagedFileQuery).not.toHaveBeenCalled()
  expect(g.setSelectedFile).toHaveBeenCalledWith(status.staged[0])
  unmount()
  const receive = vi.fn()
  window.dispatchEvent(new CustomEvent(GIT_FILE_PICKER_REQUEST, { detail: receive }))
  expect(receive).not.toHaveBeenCalled()
})
