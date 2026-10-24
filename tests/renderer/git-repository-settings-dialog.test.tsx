import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { RepositorySettingsDialog } from "@/pages/git/components/repository-settings-dialog"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("keeps remote edits as drafts until confirmation and exposes all four sections", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const settings = { templateMode: "default", template: "", remotes: [{ name: "origin", url: "https://example.com/old.git" }], signCommits: false, signingKey: "", useGlobalIdentity: true, userName: "", userEmail: "", globalName: "", globalEmail: "", ignore: "" }
  const save = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("electronAPI", {})
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { git: { getRepositorySettings: vi.fn().mockResolvedValue(settings), saveRepositorySettings: save } } })
  const close = vi.fn(),
    saved = vi.fn()
  render(
    <RepositorySettingsDialog
      open
      repoPath="/test"
      onOpenChange={close}
      onSaved={saved}
    />
  )
  await screen.findByLabelText("提交模板内容")
  expect(screen.getAllByRole("tab")).toHaveLength(4)
  fireEvent.click(screen.getByRole("tab", { name: "远程仓库" }))
  fireEvent.change(screen.getByLabelText("远程地址 1"), { target: { value: "https://example.com/new.git" } })
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "取消" }))
  expect(close).toHaveBeenCalledWith(false)
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "确定" }))
  await waitFor(() => expect(save).toHaveBeenCalledWith("/test", expect.objectContaining({ remotes: [{ name: "origin", url: "https://example.com/new.git" }] })))
  expect(saved).toHaveBeenCalled()
})
