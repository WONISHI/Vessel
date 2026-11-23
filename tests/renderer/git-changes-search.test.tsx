import { setFileIconSettings } from "@/features/file-icons/state"
import { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { GitStagedFiles } from "@/pages/git/components/git-staged-files"
import { GitUnstagedFiles } from "@/pages/git/components/git-unstaged-files"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
import { matchesGitFilePath } from "@/pages/git/file-filter"

afterEach(() => { cleanup(); setFileIconSettings({}); vi.unstubAllGlobals() })

it("matches path keywords case-insensitively, including Windows paths and multiple fragments", () => {
  expect(matchesGitFilePath("src\\API\\Services.TS", "api services")).toBe(true)
  expect(matchesGitFilePath("src/services.ts", "services vue")).toBe(false)
  expect(matchesGitFilePath("src/services.ts", " ")).toBe(true)
})

it("filters each list independently with header search icons and icon-only bulk actions", () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const stageAll = vi.fn(), unstageAll = vi.fn(), stagedClick = vi.fn()
  const status = { staged: [{ path: "README.md", status: "M" }, { path: "src/services.ts", status: "M" }], unstaged: [{ path: "api/Services.TS", status: "M" }], untracked: [{ path: "notes.md", status: "?" }], conflicts: [] }
  function Changes() {
    const [staged, setStaged] = useState("")
    const [unstaged, setUnstaged] = useState("")
    const g = { status, repoPath: "/repo", stagedFileQuery: staged, unstagedFileQuery: unstaged, setStagedFileQuery: setStaged, setUnstagedFileQuery: setUnstaged, selectedFile: null, selectedStagedPaths: [], selectedUnstagedPaths: [], handleStageAll: stageAll, handleUnstageAll: unstageAll, handleStagedItemClick: stagedClick } as unknown as GitPageModel
    return <><GitStagedFiles g={g} /><GitUnstagedFiles g={g} /></>
  }
  setFileIconSettings({ fileIconTheme: "material", fileIconWorkspace: false, fileIconResources: true })
  render(<Changes />)
  expect(document.querySelectorAll('img[data-file-icon-theme="material"]')).toHaveLength(4)
  fireEvent.click(screen.getByRole("button", { name: "搜索已暂存文件" }))
  fireEvent.change(screen.getByRole("textbox", { name: "搜索已暂存文件关键词" }), { target: { value: "SERVICES ts" } })
  expect(screen.queryByText("README.md")).toBeNull()
  expect(screen.getByText("notes.md")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "搜索未暂存文件" }))
  fireEvent.change(screen.getByRole("textbox", { name: "搜索未暂存文件关键词" }), { target: { value: "services" } })
  expect(screen.queryByText("notes.md")).toBeNull()
  expect(screen.getByText("api/Services.TS")).toBeTruthy()
  fireEvent.click(screen.getByText("src/services.ts"))
  expect(stagedClick.mock.calls[0][2]).toBe(1)
  expect(screen.getByRole("button", { name: "全部暂存" }).textContent).toBe("")
  expect(screen.getByRole("button", { name: "全部取消" }).textContent).toBe("")
  fireEvent.click(screen.getByRole("button", { name: "全部暂存" }))
  fireEvent.click(screen.getByRole("button", { name: "全部取消" }))
  expect(stageAll).toHaveBeenCalledOnce()
  expect(unstageAll).toHaveBeenCalledOnce()
  fireEvent.keyDown(screen.getByRole("textbox", { name: "搜索未暂存文件关键词" }), { key: "Escape" })
  expect(screen.queryByText("README.md")).toBeNull()
  expect(screen.getByText("notes.md")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "搜索已暂存文件" }))
  fireEvent.keyDown(screen.getByRole("textbox", { name: "搜索已暂存文件关键词" }), { key: "Escape" })
  expect(screen.getByText("README.md")).toBeTruthy()
})
