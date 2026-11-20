import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { PushDialog } from "@/pages/git/components/push-dialog"
import { useGitCommitActions } from "@/pages/git/hooks/use-git-commit-actions"
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  HTMLElement.prototype.scrollIntoView = vi.fn()
  window.electronAPI = { ...window.electronAPI, git: { ...window.electronAPI?.git, getPushInfo: vi.fn(async () => ({ remotes: [{ name: "origin", url: "/tmp/test.git" }], remoteBranches: [], branches: [{ name: "main", current: true, upstreamRemote: "", upstreamBranch: "" }] })) } }
})

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("waits for confirmation and submits the selected local/remote mapping and tag/tracking choices", async () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  window.electronAPI = { ...window.electronAPI, git: { ...window.electronAPI?.git, getPushInfo: vi.fn(async () => ({ remotes: [{ name: "origin", url: "/tmp/test.git" }], remoteBranches: ["origin/main"], branches: [{ name: "main", current: true, upstreamRemote: "origin", upstreamBranch: "main" }, { name: "dev", current: false, upstreamRemote: "", upstreamBranch: "" }] })) } }
  const onPush = vi.fn(async () => {}), onClose = vi.fn()
  render(<PushDialog repoPath="/repo" onPush={onPush} onClose={onClose} />)
  await screen.findByLabelText("推送分支 dev")
  expect(screen.getByLabelText("推送分支 main").getAttribute("data-state")).toBe("checked")
  expect(onPush).not.toHaveBeenCalled()
  fireEvent.click(screen.getByLabelText("推送分支 main"))
  fireEvent.click(screen.getByLabelText("推送分支 dev"))
  fireEvent.keyDown(screen.getByLabelText("dev 的远程分支"), { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("option", { name: "输入其他分支名称…" }))
  fireEvent.change(screen.getByLabelText("dev 的远程分支"), { target: { value: "release/dev" } })
  fireEvent.click(screen.getByLabelText("跟踪分支 dev"))
  fireEvent.click(screen.getByLabelText("推送所有标签"))
  fireEvent.click(screen.getByRole("button", { name: "确定" }))
  await waitFor(() => expect(onPush).toHaveBeenCalledWith({ remote: "origin", branches: [{ local: "dev", remote: "release/dev", track: false }], tags: true }))
  expect(onClose).toHaveBeenCalledOnce()
})

it("opens a push request without contacting the remote until the dialog submits", async () => {
  const pushSelection = vi.fn(async () => ({ output: "" }))
  window.electronAPI.git.pushSelection = pushSelection
  const repo = { repoPath: "/repo", remotePending: { current: false }, setLoading: vi.fn(), setRemoteOperation: vi.fn(), refresh: vi.fn(async () => {}) }
  const hook = renderHook(() => useGitCommitActions(repo as any, async () => true))
  act(() => hook.result.current.handlePush("origin"))
  expect(hook.result.current.pushRequest).toMatchObject({ repoPath: "/repo", remote: "origin" })
  expect(pushSelection).not.toHaveBeenCalled()
  const selection = { remote: "origin", branches: [{ local: "main", remote: "main", track: true }], tags: false }
  await act(async () => hook.result.current.submitPush(selection))
  expect(pushSelection).toHaveBeenCalledExactlyOnceWith("/repo", selection, expect.any(String))
  repo.remotePending.current = true
  await expect(hook.result.current.submitPush(selection)).rejects.toThrow("已有远程操作")
})

it("uses a compact shadcn branch picker while preserving custom names and disabling the URL", async () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  HTMLElement.prototype.scrollIntoView = vi.fn()
  window.electronAPI = { ...window.electronAPI, git: { ...window.electronAPI.git, getPushInfo: vi.fn(async () => ({ remotes: [{ name: "origin", url: "/tmp/test.git" }], remoteBranches: ["origin/main", "origin/release"], branches: [{ name: "main", current: true, upstreamRemote: "origin", upstreamBranch: "main" }] })) } }
  const onPush = vi.fn(async () => {})
  render(<PushDialog repoPath="/repo" onPush={onPush} onClose={vi.fn()} />)
  await screen.findByLabelText("推送分支 main")
  expect((screen.getByLabelText("远程仓库地址") as HTMLInputElement).disabled).toBe(true)
  expect(document.querySelector("datalist")).toBeNull()
  fireEvent.keyDown(screen.getByLabelText("main 的远程分支"), { key: "ArrowDown" })
  expect(screen.getByRole("option", { name: "main" }).getAttribute("data-state")).toBe("checked")
  fireEvent.click(await screen.findByRole("option", { name: "release" }))
  expect(screen.getByLabelText("main 的远程分支").textContent).toBe("release")
  expect(onPush).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByLabelText("main 的远程分支"), { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("option", { name: "输入其他分支名称…" }))
  fireEvent.change(screen.getByLabelText("main 的远程分支"), { target: { value: "custom/new" } })
  fireEvent.click(screen.getByRole("button", { name: "确定" }))
  await waitFor(() => expect(onPush).toHaveBeenCalledWith({ remote: "origin", branches: [{ local: "main", remote: "custom/new", track: true }], tags: false }))
})

it("shows push progress until completion and restores the form after a failure", async () => {
  window.electronAPI = { ...window.electronAPI, git: { ...window.electronAPI.git, getPushInfo: vi.fn(async () => ({ remotes: [{ name: "origin", url: "/tmp/test.git" }], remoteBranches: [], branches: [{ name: "main", current: true, upstreamRemote: "", upstreamBranch: "" }] })) } }
  let reject!: (reason: Error) => void
  const onPush = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail }))
  const onClose = vi.fn()
  render(<PushDialog repoPath="/repo" onPush={onPush} onClose={onClose} />)
  await screen.findByLabelText("推送分支 main")
  fireEvent.click(screen.getByRole("button", { name: "确定" }))
  expect(await screen.findByRole("status")).toHaveProperty("textContent", expect.stringContaining("正在推送"))
  expect(screen.queryByRole("button", { name: "确定" })).toBeNull()
  expect(screen.getByText("已等待 0 秒")).toBeTruthy()
  expect(screen.getByLabelText("当前项目").textContent).toBe("项目：repo")
  await act(async () => reject(new Error("remote failed")))
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "remote failed")
  expect(screen.getByLabelText("推送分支 main").getAttribute("data-state")).toBe("checked")
  expect(onClose).not.toHaveBeenCalled()
})

it("cancels the active push and waits for the process to stop before closing", async () => {
  let reject!: (error: Error) => void
  const onPush = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail }))
  const onCancel = vi.fn(async () => true), onClose = vi.fn()
  render(<PushDialog repoPath="/projects/Vessel" onPush={onPush} onCancel={onCancel} onClose={onClose} />)
  await screen.findByLabelText("推送分支 main")
  fireEvent.click(screen.getByRole("button", { name: "确定" }))
  expect(screen.getByLabelText("当前项目").textContent).toBe("项目：Vessel")
  fireEvent.click(screen.getByRole("button", { name: "取消推送" }))
  await waitFor(() => expect(onCancel).toHaveBeenCalledOnce())
  expect((screen.getByRole("button", { name: "正在取消…" }) as HTMLButtonElement).disabled).toBe(true)
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => reject(new Error("推送已取消")))
  expect(onClose).toHaveBeenCalledOnce()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("passes the active operation token to cancellation and releases the remote-operation lock", async () => {
  let reject!: (error: Error) => void
  const pushSelection = vi.fn(() => new Promise<{ output: string }>((_resolve, fail) => { reject = fail }))
  const cancelPush = vi.fn(async () => { reject(new Error("推送已取消")); return true })
  window.electronAPI.git = { ...window.electronAPI.git, pushSelection, cancelPush }
  const repo = { repoPath: "/repo", remotePending: { current: false }, setLoading: vi.fn(), setRemoteOperation: vi.fn(), refresh: vi.fn(async () => {}) }
  const hook = renderHook(() => useGitCommitActions(repo as any, async () => true))
  const selection = { remote: "origin", branches: [{ local: "main", remote: "main", track: true }], tags: false }
  let outcome!: Promise<unknown>
  act(() => { outcome = hook.result.current.submitPush(selection).catch(error => error) })
  const token = pushSelection.mock.calls[0][2]
  await act(async () => { await hook.result.current.cancelPush(); await outcome })
  expect(cancelPush).toHaveBeenCalledWith("/repo", token)
  expect(repo.remotePending.current).toBe(false)
  expect(repo.setLoading).toHaveBeenLastCalledWith(false)
  expect(repo.setRemoteOperation).toHaveBeenLastCalledWith(null)
  expect(await hook.result.current.cancelPush()).toBe(false)
})
