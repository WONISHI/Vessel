import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useGitStashView } from "@/pages/git/hooks/use-git-stash-view"
import { GitSidebarNav } from "@/pages/git/components/git-sidebar-nav"
import { GitStashDetails } from "@/pages/git/components/git-stash-details"
import type { GitRepositoryState } from "@/pages/git/hooks/use-git-repository"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
import type { GitStashDetail } from "@vessel/type"

vi.mock("@/pages/git/components/git-branch-tree", () => ({ GitBranchTree: () => null }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const hash = "a".repeat(40), otherHash = "b".repeat(40)
const record = { index: 2, name: "预览测试", date: "2026-11-18T11:47:30+08:00", hash }
const detail: GitStashDetail = { hash, files: [{ path: "文件.md", status: "M", source: "worktree" }, { path: "new.txt", status: "?", source: "untracked" }] }
const repo = { repoPath: "/repo", setActiveTab: vi.fn() } as unknown as GitRepositoryState

it("loads a saved file list and its diff by immutable stash hash", async () => {
  const getStashDetail = vi.fn().mockResolvedValue(detail), getStashDiff = vi.fn().mockResolvedValue({ diff: "saved diff" })
  vi.stubGlobal("electronAPI", { git: { getStashDetail, getStashDiff } })
  const { result } = renderHook(() => useGitStashView(repo))
  await act(async () => { await result.current.viewStash(record) })
  expect(getStashDetail).toHaveBeenCalledWith("/repo", hash)
  expect(getStashDiff).toHaveBeenCalledWith("/repo", hash, "文件.md")
  expect(result.current.stashDetail?.files).toHaveLength(2)
  await act(async () => { result.current.selectStashFile(detail.files[1]) })
  expect(getStashDiff).toHaveBeenLastCalledWith("/repo", hash, "new.txt")
  expect(result.current.selectedStashFile?.path).toBe("new.txt")
})

it("rejects late responses from an older stash selection", async () => {
  let resolveFirst!: (value: GitStashDetail) => void
  const first = new Promise<GitStashDetail>((resolve) => { resolveFirst = resolve })
  const next = { ...detail, hash: otherHash }
  vi.stubGlobal("electronAPI", { git: { getStashDetail: vi.fn().mockImplementation((_, id) => id === hash ? first : Promise.resolve(next)), getStashDiff: vi.fn().mockResolvedValue({ diff: "next stash" }) } })
  const { result } = renderHook(() => useGitStashView(repo))
  let pending!: Promise<void>
  act(() => { pending = result.current.viewStash(record) })
  await act(async () => { await result.current.viewStash({ ...record, hash: otherHash, name: "next" }) })
  await act(async () => { resolveFirst(detail); await pending })
  expect(result.current.selectedStash?.name).toBe("next")
  expect(result.current.stashDetail?.hash).toBe(otherHash)
  expect(result.current.stashDiffText).toBe("next stash")
})

it("does not show a previous repository's preview after a repository switch", async () => {
  vi.stubGlobal("electronAPI", { git: { getStashDetail: vi.fn().mockResolvedValue(detail), getStashDiff: vi.fn().mockResolvedValue({ diff: "saved diff" }) } })
  const { result, rerender } = renderHook(({ path }) => useGitStashView({ ...repo, repoPath: path }), { initialProps: { path: "/repo" } })
  await act(async () => { await result.current.viewStash(record) })
  rerender({ path: "/other" })
  expect(result.current.selectedStash).toBeUndefined()
  expect(result.current.stashDiffText).toBe("")
})

it("opens the sidebar record without applying it, and keeps the apply action separate", () => {
  const viewStash = vi.fn(), handleStashApply = vi.fn(), handleStashPop = vi.fn()
  const g = { activeTab: "status", branches: { current: "main", local: [], remote: [] }, stashes: [record], viewStash, handleStashApply, handleStashPop } as unknown as GitPageModel
  render(<GitSidebarNav g={g} />)
  fireEvent.click(screen.getByText("预览测试"))
  expect(viewStash).toHaveBeenCalledExactlyOnceWith(record)
  expect(handleStashPop).not.toHaveBeenCalled()
  viewStash.mockClear()
  fireEvent.click(screen.getByRole("button", { name: "应用贮藏并保留" }))
  expect(handleStashApply).toHaveBeenCalledExactlyOnceWith(2)
  expect(viewStash).not.toHaveBeenCalled()
})

it("shows saved files and uses the latest record ordinal for apply-with-retention", () => {
  vi.stubGlobal("ResizeObserver", class { observe() { /* jsdom does not lay out panels. */ } unobserve() { /* No observation. */ } disconnect() { /* No observation. */ } })
  const selectStashFile = vi.fn(), handleStashApply = vi.fn()
  const g = { selectedStash: record, stashes: [{ ...record, index: 0 }], stashDetail: detail, selectedStashFile: detail.files[0], stashDiffText: "", selectStashFile, handleStashApply } as unknown as GitPageModel
  render(<GitStashDetails g={g} />)
  expect(document.querySelector("time")?.getAttribute("datetime")).toBe(record.date)
  expect(screen.getByText("new.txt")).toBeTruthy()
  fireEvent.click(screen.getByText("new.txt"))
  expect(selectStashFile).toHaveBeenCalledWith(detail.files[1])
  fireEvent.click(screen.getByRole("button", { name: "应用并保留" }))
  expect(handleStashApply).toHaveBeenCalledWith(0)
})
