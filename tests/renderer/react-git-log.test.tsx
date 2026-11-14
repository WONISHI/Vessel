import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { GitCommitItem } from "@vessel/type"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
import { GitHistoryList } from "@/pages/git/components/git-history-list"
import { toGitLogEntries } from "@/pages/git/components/git-log-entries"

function commit(hash: string, parents: string[], refs: string[] = []): GitCommitItem {
  return { hash, parents, refs, shortHash: hash, message: `message ${hash}`, author: "Test", email: "test@example.com", timestamp: Date.UTC(2026, 0, 1), date: "2026/1/1" }
}
const commits = [commit("merge", ["main", "side"], ["HEAD -> master", "origin/master"]), commit("side", ["base"], ["tag:v1"]), commit("main", ["base"]), commit("base", ["older-unloaded"])]
function model(items = commits) {
  return {
    branches: { current: "master", remote: ["origin/master"], local: ["master"] }, commits: items,
    unpushedHashes: new Set(), commitTotal: 10, branchCommitTotal: 10, branchSyncedTotal: 10,
    aheadCount: 0, behindCount: 0, historyScope: "all", selectedCommitIndex: 0,
    setSelectedCommitIndex: vi.fn(), setActiveTab: vi.fn(), loadMoreHistory: vi.fn(), copyToClipboard: vi.fn(),
    setBranchStartPoint: vi.fn(), setCreateBranchOpen: vi.fn(), handleCreateTag: vi.fn(),
    handleOpenRemoteCommit: vi.fn()
  } as unknown as GitPageModel
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn() })
  vi.stubGlobal("IntersectionObserver", class { observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn() })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("maps first-parent paths and retains the real parents beyond the loaded page", () => {
  const entries = toGitLogEntries(commits, "master")
  expect(entries.filter((entry) => entry.branch === "master").map((entry) => entry.hash)).toEqual(["merge", "main", "base"])
  expect(entries[1].branch).not.toBe("master")
  expect(entries[3].parents).toEqual(["older-unloaded"])
  expect(entries[0].committerDate).toBe("2026-01-01T00:00:00.000Z")
  expect(entries[0].author?.name).toBe("Test")
})

it("renders the actual library with merge edges, ref badges and loads the next page", () => {
  const g = model()
  const { container } = render(<GitHistoryList g={g} />)
  expect(container.querySelector('#react-git-log')).toBeTruthy()
  expect(container.querySelectorAll('[data-testid^="react-git-log-table-row-"]')).toHaveLength(5)
  expect(container.querySelector('[id="commit-node-merge"]')).toBeTruthy()
  fireEvent.click(container.querySelector('[id="commit-node-main"]')!)
  expect(g.setSelectedCommitIndex).toHaveBeenCalledWith(2)
  expect(screen.getByText("分支 / 标签")).toBeTruthy()
  expect(screen.getByText("提交图")).toBeTruthy()
  expect(screen.getByText("提交信息")).toBeTruthy()
  expect(screen.getByText("作者")).toBeTruthy()
  expect(screen.getByText("提交时间")).toBeTruthy()
  expect(screen.getAllByText("master").length).toBeGreaterThan(0)
  expect(screen.getByText("v1")).toBeTruthy()
  expect(screen.getByText("// WIP")).toBeTruthy()
  fireEvent.click(screen.getByText("message side"))
  expect(g.setSelectedCommitIndex).toHaveBeenCalledWith(1)
  fireEvent.click(screen.getByText("加载更早记录"))
  expect(g.loadMoreHistory).toHaveBeenCalledOnce()
})

it("retains commit-specific context actions after the library orders the rows", () => {
  const g = model()
  render(<GitHistoryList g={g} />)
  fireEvent.contextMenu(screen.getByText("message side"), { clientX: 20, clientY: 20 })
  fireEvent.click(screen.getByText("复制提交 SHA-1"))
  expect(g.copyToClipboard).toHaveBeenCalledWith("side", "提交 SHA-1")
})

it("appends older history and handles empty repositories without placeholder commits", () => {
  const g = model()
  const { rerender, container } = render(<GitHistoryList g={g} />)
  rerender(<GitHistoryList g={{ ...g, commits: [...commits, commit("older-unloaded", [])] }} />)
  expect(screen.getByText("message older-unloaded")).toBeTruthy()
  expect(container.querySelectorAll('[data-testid^="react-git-log-table-row-"]')).toHaveLength(6)
  rerender(<GitHistoryList g={{ ...g, commits: [], commitTotal: 0 }} />)
  expect(container.querySelector('#react-git-log')).toBeNull()
})

it("shows actual deduplicated working tree counts in the native index row", () => {
  const g = model()
  g.status = { isRepo: true, branch: "master", upstream: "origin/master", ahead: 0, behind: 0,
    staged: [{ path: "new.ts", status: "A" }],
    unstaged: [{ path: "new.ts", status: "M" }, { path: "old.ts", status: "D" }],
    untracked: [{ path: "note.md", status: "?" }], conflicts: [] }
  render(<GitHistoryList g={g} />)
  const indexRow = screen.getByTestId("react-git-log-table-row-0")
  expect(indexRow.textContent).toContain("// WIP")
  expect(indexRow.textContent).toContain("2")
  fireEvent.click(screen.getByText("// WIP"))
  expect(g.setActiveTab).toHaveBeenCalledWith("status")
})
