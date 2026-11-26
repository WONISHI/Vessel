import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { GitStagedFiles } from "@/pages/git/components/git-staged-files"
import { GitUnstagedFiles } from "@/pages/git/components/git-unstaged-files"
import { useGitFileActions } from "@/pages/git/hooks/use-git-file-actions"
import { getGitFileSelection, reconcileGitFileSelection, updateGitFileSelection } from "@/pages/git/file-selection-state"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
import type { GitRepositoryState } from "@/pages/git/hooks/use-git-repository"
import type { GitStatusResult } from "@vessel/type"

beforeEach(() => {
  localStorage.setItem("git-staged-tree-view", "true")
  localStorage.setItem("git-unstaged-tree-view", "true")
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
})
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })

it.each(["staged", "unstaged"])("operates on all %s folder descendants even when collapsed or filtered, without including sibling folders", section => {
  const action = vi.fn()
  const files = [{ path: "src/one.ts", status: "M" }, { path: "src/nested/two.ts", status: "M" }, { path: "src-other/no.ts", status: "M" }]
  const g = { repoPath: "/repo", status: { staged: files, unstaged: files, untracked: [], conflicts: [] }, selectedStagedPaths: [], selectedUnstagedPaths: [],
    stagedFileQuery: "one", unstagedFileQuery: "one", handleStageMultiple: action, handleUnstageMultiple: action
  } as unknown as GitPageModel
  render(section === "staged" ? <GitStagedFiles g={g}/> : <GitUnstagedFiles g={g}/>)
  fireEvent.click(screen.getByRole("button", { name: "收起目录 src" }))
  expect(screen.queryByText("one.ts")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: `${section === "staged" ? "取消暂存" : "暂存"}目录 src` }))
  expect(action).toHaveBeenCalledExactlyOnceWith(["src/one.ts", "src/nested/two.ts"], { clearSelection: true })
  expect(screen.getByRole("button", { name: "展开目录 src" }).getAttribute("aria-expanded")).toBe("false")
})

it.each(["stage", "unstage"])("clears all checks only after successful folder %s and keeps them cleared after refresh", async method => {
  const repoPath = `/folder/${crypto.randomUUID()}`
  const a = { path: "a.ts", status: "M" }, b = { path: "b.ts", status: "M" }, conflict = { path: "c.ts", status: "U" }
  updateGitFileSelection(repoPath, previous => ({ ...previous, selectedFile: method === "stage" ? b : a, activeFileSection: method === "stage" ? "unstaged" : "staged", selectedStagedPaths: [a.path], selectedUnstagedPaths: [b.path], selectedConflictPaths: [conflict.path] }))
  const status = { staged: method === "stage" ? [a, b] : [], unstaged: method === "stage" ? [] : [a, b], untracked: [], conflicts: [conflict] } as unknown as GitStatusResult
  const operation = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = { git: { stage: operation, unstage: operation } } as any
  const refresh = vi.fn(async () => reconcileGitFileSelection(repoPath, status))
  const { result } = renderHook(() => useGitFileActions({ repoPath, status, refresh } as GitRepositoryState))
  await act(async () => { await result.current[method === "stage" ? "handleStageMultiple" : "handleUnstageMultiple"]([method === "stage" ? b.path : a.path], { clearSelection: true }) })
  expect(operation).toHaveBeenCalledOnce()
  expect(getGitFileSelection(repoPath)).toMatchObject({ selectedStagedPaths: [], selectedUnstagedPaths: [], selectedConflictPaths: [] })
  reconcileGitFileSelection(repoPath, status)
  expect(getGitFileSelection(repoPath)).toMatchObject({ selectedStagedPaths: [], selectedUnstagedPaths: [], selectedConflictPaths: [] })
})

it("retains checks when the folder operation fails", async () => {
  const repoPath = `/folder-failure/${crypto.randomUUID()}`
  updateGitFileSelection(repoPath, previous => ({ ...previous, selectedUnstagedPaths: ["one.ts"] }))
  window.electronAPI = { git: { stage: vi.fn().mockRejectedValue(new Error("index locked")) } } as any
  const refresh = vi.fn()
  const { result } = renderHook(() => useGitFileActions({ repoPath, refresh } as unknown as GitRepositoryState))
  await act(async () => { await result.current.handleStageMultiple(["one.ts"], { clearSelection: true }) })
  expect(getGitFileSelection(repoPath).selectedUnstagedPaths).toEqual(["one.ts"])
  expect(refresh).not.toHaveBeenCalled()
})
