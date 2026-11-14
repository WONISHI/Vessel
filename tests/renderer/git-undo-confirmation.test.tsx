import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useGitCommitActions } from "@/pages/git/hooks/use-git-commit-actions"
import { useGitFileActions } from "@/pages/git/hooks/use-git-file-actions"
import type { GitRepositoryState } from "@/pages/git/hooks/use-git-repository"

vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each(["mixed", "soft"] as const)("requires the shared confirmation before undoing a %s commit", async (mode) => {
  const reset = vi.fn().mockResolvedValue(undefined), refresh = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("electronAPI", { git: { reset } })
  const nativeConfirm = vi.fn()
  vi.stubGlobal("confirm", nativeConfirm)
  const repo = { repoPath: "/project", commits: [{ shortHash: "abc1234", message: "测试提交" }], refresh } as unknown as GitRepositoryState
  const { result } = renderHook(() => {
    const files = useGitFileActions(repo)
    return { ...files, ...useGitCommitActions(repo, files.requestConfirmation) }
  })
  let pending: Promise<void>
  act(() => { pending = result.current.handleUndoLastCommit(mode) })
  expect(result.current.confirmation).toContain("abc1234 测试提交")
  expect(result.current.confirmationTone).toBe("primary")
  expect(reset).not.toHaveBeenCalled()
  expect(nativeConfirm).not.toHaveBeenCalled()
  await act(async () => { result.current.settleConfirmation(false); await pending })
  expect(reset).not.toHaveBeenCalled()
  act(() => { pending = result.current.handleUndoLastCommit(mode) })
  await act(async () => { result.current.settleConfirmation(true); await pending })
  expect(reset).toHaveBeenCalledExactlyOnceWith("/project", "HEAD~1", mode)
  expect(refresh).toHaveBeenCalledOnce()
  expect(result.current.confirmation).toBeNull()
})
