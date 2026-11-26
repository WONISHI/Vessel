import { setFileIconSettings } from "@/features/file-icons/state"
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
afterEach(() => { cleanup(); setFileIconSettings({}); vi.unstubAllGlobals() })
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

it("selects conflict rows without checkboxes using Shift ranges and select-all, then stages only the selection", async () => {
  const stage = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("electronAPI", { git: { stage } })
  function Fixture() {
    const repo = useRepo()
    const selection = useGitFileSelection(repo)
    const actions = useGitFileActions(repo)
    return <GitConflictFiles g={{ ...repo, ...selection, ...actions } as GitPageModel} />
  }
  setFileIconSettings({ fileIconTheme: "material", fileIconResources: true, fileIconWorkspace: false })
  render(<Fixture />)
  expect(screen.queryByRole("checkbox")).toBeNull()
  expect(screen.queryByText("在编辑器中修复并保存，再选中文件标记解决并暂存。")).toBeNull()
  expect(document.querySelectorAll('img[data-file-icon-theme="material"]')).toHaveLength(3)
  expect(screen.queryByRole("button", { name: /标记解决并暂存所选/ })).toBeNull()
  fireEvent.click(screen.getByRole("option", { name: /冲突.md/ }))
  fireEvent.click(screen.getByRole("option", { name: /third.md/ }), { shiftKey: true })
  expect(screen.getAllByRole("option", { selected: true })).toHaveLength(3)
  fireEvent.click(screen.getByRole("option", { name: /other.md/ }), { ctrlKey: true })
  fireEvent.contextMenu(screen.getByRole("option", { name: /冲突.md/ }), { clientX: 20, clientY: 20 })
  fireEvent.click(screen.getByRole("menuitem", { name: "标记为已解决并暂存" }))
  await waitFor(() => expect(stage).toHaveBeenCalledExactlyOnceWith("/repo", ["冲突.md", "third.md"]))
  await waitFor(() => expect(screen.queryAllByRole("option", { selected: true })).toHaveLength(0))
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


it("resolves all conflicts from the header and only one from a row", () => {
  const resolve = vi.fn()
  const g = { status, repoPath: "/repo", selectedConflictPaths: ["冲突.md"], handleResolveConflicts: resolve } as unknown as GitPageModel
  render(<GitConflictFiles g={g} />)
  const all = screen.getByRole("button", { name: "全部标记为已解决并暂存" })
  expect(all.textContent).toBe("")
  fireEvent.click(all)
  expect(resolve).toHaveBeenLastCalledWith(status.conflicts.map(file => file.path))
  const single = screen.getByRole("button", { name: "标记 other.md 为已解决并暂存" })
  expect(single.querySelector(".lucide-plus")).toBeTruthy()
  expect(single.className).toContain("text-stone-400")
  fireEvent.click(single)
  expect(resolve).toHaveBeenLastCalledWith(["other.md"])
})

it("supports independent conflict tree/search controls and selects only displayed files in tree ranges and filtered select-all", async () => {
  localStorage.removeItem('git-conflicts-tree-view')
  const stage = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('electronAPI', { git: { stage } })
  const conflicts = ['README.md', 'src/item10.ts', 'src/item2.ts', 'src/components/a.ts', 'src/components/b.ts'].map(path => ({ path, status: 'U' }))
  function Fixture() {
    const original = useRepo()
    const repo = { ...original, status: { ...status, conflicts } }
    const [query, setQuery] = useState('')
    const selection = useGitFileSelection(repo, { staged: '', unstaged: '', conflicts: query })
    const actions = useGitFileActions(repo)
    return <GitConflictFiles g={{ ...repo, ...selection, ...actions, conflictFileQuery: query, setConflictFileQuery: setQuery } as GitPageModel} />
  }
  const view = render(<Fixture />)
  fireEvent.click(screen.getByRole('button', { name: '冲突文件切换为树形视图' }))
  expect(screen.getByLabelText('变更文件树')).toBeTruthy()
  fireEvent.click(screen.getByRole('option', { name: /a.ts/ }))
  expect(screen.getByLabelText('冲突文件位置').textContent).toBe('1/5')
  fireEvent.click(screen.getByRole('option', { name: /item10.ts/ }), { shiftKey: true })
  expect(screen.getAllByRole('option', { selected: true })).toHaveLength(4)
  expect(screen.getByRole('option', { name: /README.md/ }).getAttribute('aria-selected')).toBe('false')
  expect(screen.getByLabelText('冲突文件位置').textContent).toBe('4/5')
  fireEvent.click(screen.getByRole('button', { name: '搜索冲突文件' }))
  fireEvent.change(screen.getByRole('textbox', { name: '搜索冲突文件关键词' }), { target: { value: 'components' } })
  expect(screen.getAllByRole('option')).toHaveLength(2)
  expect(screen.getByLabelText('冲突文件位置').textContent).toBe('0/2')
  fireEvent.click(screen.getByRole('option', { name: /b.ts/ }))
  fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
  expect(screen.getAllByRole('option', { selected: true })).toHaveLength(2)
  fireEvent.contextMenu(screen.getByRole('option', { name: /b.ts/ }), { clientX: 20, clientY: 20 })
  fireEvent.click(screen.getByRole('menuitem', { name: '标记为已解决并暂存' }))
  await waitFor(() => expect(stage).toHaveBeenCalledWith('/repo', ['src/components/a.ts', 'src/components/b.ts']))
  fireEvent.click(screen.getByRole('button', { name: '搜索冲突文件' }))
  fireEvent.change(screen.getByRole('textbox', { name: '搜索冲突文件关键词' }), { target: { value: 'missing' } })
  expect(screen.getByText('没有匹配的冲突文件')).toBeTruthy()
  expect(screen.getByLabelText('冲突文件位置').textContent).toBe('0/0')
  view.unmount()
  render(<Fixture />)
  expect(screen.getByLabelText('变更文件树')).toBeTruthy()
  localStorage.removeItem('git-conflicts-tree-view')
})
