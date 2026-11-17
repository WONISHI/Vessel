import { useState } from "react"
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { GitStatusResult } from "@vessel/type"
import { GitConflictFiles } from "@/pages/git/components/git-conflict-files"
import { useGitFileSelection } from "@/pages/git/hooks/use-git-file-selection"
import { useGitFileActions } from "@/pages/git/hooks/use-git-file-actions"
import type { GitRepositoryState } from "@/pages/git/hooks/use-git-repository"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
import { toast } from "@/components/ui/sonner"

vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const status: GitStatusResult = { isRepo: true, branch: "main", upstream: "", ahead: 0, behind: 0, staged: [], unstaged: [{ path: "ordinary.md", status: "M" }], untracked: [], conflicts: [{ path: "冲突.md", status: "U" }, { path: "other.md", status: "U" }, { path: "third.md", status: "U" }] }
function useRepo() {
  const [refresh] = useState(() => vi.fn().mockResolvedValue(undefined))
  const [setActiveTab] = useState(() => vi.fn())
  const [selectedConflictPaths, setSelectedConflictPaths] = useState<string[]>([])
  const [selectedStagedPaths, setSelectedStagedPaths] = useState<string[]>([])
  const [selectedUnstagedPaths, setSelectedUnstagedPaths] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [lastConflictClickedIndex, setLastConflictClickedIndex] = useState(-1)
  const [lastStagedClickedIndex, setLastStagedClickedIndex] = useState(-1)
  const [lastUnstagedClickedIndex, setLastUnstagedClickedIndex] = useState(-1)
  const [activeFileSection, setActiveFileSection] = useState("conflicts")
  return { status, activeTab: "status", repoPath: "/repo", branches: { current: "main" }, refresh, setActiveTab, selectedConflictPaths, setSelectedConflictPaths, selectedStagedPaths, setSelectedStagedPaths, selectedUnstagedPaths, setSelectedUnstagedPaths, selectedFile, setSelectedFile, lastConflictClickedIndex, setLastConflictClickedIndex, lastStagedClickedIndex, setLastStagedClickedIndex, lastUnstagedClickedIndex, setLastUnstagedClickedIndex, activeFileSection, setActiveFileSection } as unknown as GitRepositoryState
}

it("selects conflict rows with checkboxes, Shift ranges and select-all, then stages only the selection", async () => {
  const stage = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("electronAPI", { git: { stage } })
  function Fixture() {
    const repo = useRepo()
    const selection = useGitFileSelection(repo)
    const actions = useGitFileActions(repo)
    return <GitConflictFiles g={{ ...repo, ...selection, ...actions } as GitPageModel} />
  }
  render(<Fixture />)
  const apply = screen.getByRole("button", { name: "标记解决并暂存所选 (0)" }) as HTMLButtonElement
  expect(apply.disabled).toBe(true)
  fireEvent.click(screen.getByRole("checkbox", { name: "选择冲突文件 冲突.md" }))
  fireEvent.click(screen.getByRole("option", { name: /third.md/ }), { shiftKey: true })
  expect(screen.getAllByRole("option", { selected: true })).toHaveLength(3)
  fireEvent.click(screen.getByRole("checkbox", { name: "选择冲突文件 other.md" }))
  fireEvent.click(screen.getByRole("button", { name: "标记解决并暂存所选 (2)" }))
  await waitFor(() => expect(stage).toHaveBeenCalledExactlyOnceWith("/repo", ["冲突.md", "third.md"]))
  await waitFor(() => expect(screen.getByRole("button", { name: "标记解决并暂存所选 (0)" })).toBeTruthy())
  fireEvent.click(screen.getByRole("option", { name: /冲突.md/ }))
  fireEvent.keyDown(window, { key: "a", ctrlKey: true })
  expect(screen.getAllByRole("option", { selected: true })).toHaveLength(3)
})

it("refreshes conflicts and switches to their section after a conflicted stash pop", async () => {
  const stashPop = vi.fn().mockResolvedValue({ conflicts: ["冲突.md"], dropped: false, output: "CONFLICT" })
  vi.stubGlobal("electronAPI", { git: { stashPop } })
  const { result } = renderHook(() => { const repo = useRepo(); return { repo, ...useGitFileActions(repo) } })
  await act(async () => { await result.current.handleStashPop(1) })
  expect(stashPop).toHaveBeenCalledWith("/repo", 1, undefined)
  expect(result.current.repo.selectedConflictPaths).toEqual(["冲突.md"])
  expect(result.current.repo.selectedFile).toEqual({ path: "冲突.md", status: "U" })
  expect(result.current.repo.setActiveTab).toHaveBeenCalledWith("status")
  expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("1 个文件"), { description: expect.stringContaining("原贮藏记录已保留") })
})

it("passes the displayed stash identity to the backend so a shifted list cannot restore another record", async () => {
  const stashPop = vi.fn().mockResolvedValue({ conflicts: [], dropped: true, output: "" })
  vi.stubGlobal("electronAPI", { git: { stashPop } })
  const { result } = renderHook(() => { const repo = useRepo(); return useGitFileActions({ ...repo, stashes: [{ index: 1, hash: "a".repeat(40), name: "selected", date: "" }] }) })
  await act(async () => { await result.current.handleStashPop(1) })
  expect(stashPop).toHaveBeenCalledWith("/repo", 1, "a".repeat(40))
})

it("refreshes even after pop failure so partially applied conflicts are visible", async () => {
  vi.stubGlobal("electronAPI", { git: { stashPop: vi.fn().mockRejectedValue(new Error("failed to restore untracked files")) } })
  const { result } = renderHook(() => { const repo = useRepo(); return { repo, ...useGitFileActions(repo) } })
  await act(async () => { await result.current.handleStashPop() })
  expect(result.current.repo.refresh).toHaveBeenCalledOnce()
  expect(toast.error).toHaveBeenCalledWith("弹出贮藏失败", expect.any(Object))
})

it("stages ordinary worktree changes without silently marking conflicts resolved", async () => {
  const stage = vi.fn().mockResolvedValue(undefined), stageAll = vi.fn()
  vi.stubGlobal("electronAPI", { git: { stage, stageAll } })
  const { result } = renderHook(() => useGitFileActions(useRepo()))
  await act(async () => { await result.current.handleStageAll() })
  expect(stage).toHaveBeenCalledWith("/repo", ["ordinary.md"])
  expect(stageAll).not.toHaveBeenCalled()
})

it("reports that the original record is retained after apply-with-conflicts", async () => {
  const stashApply = vi.fn().mockResolvedValue({ conflicts: ["冲突.md"], dropped: false, output: "CONFLICT" })
  vi.stubGlobal("electronAPI", { git: { stashApply } })
  const { result } = renderHook(() => { const repo = useRepo(); return { repo, ...useGitFileActions(repo) } })
  await act(async () => { await result.current.handleStashApply(2) })
  expect(stashApply).toHaveBeenCalledWith("/repo", 2, undefined)
  expect(result.current.repo.selectedConflictPaths).toEqual(["冲突.md"])
  expect(toast.warning).toHaveBeenCalledWith(expect.any(String), { description: expect.stringContaining("原贮藏记录已保留") })
})
