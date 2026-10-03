import React from "react"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
vi.mock("../../src/renderer/src/pages/workspace/hooks/useWorkspace", () => ({ useWorkspace: () => ({ workspace: { path: "/vault" }, openFiles: [], closeWorkspaceFiles: vi.fn(), renameWorkspaceTab: vi.fn() }) }))
import { FileActions } from "../../src/renderer/src/pages/workspace/components/layout-aside/layout-workspace-sidebar/file-actions"
afterEach(cleanup)
it("requires confirmation before trashing and keeps failures visible", async () => {
  const mutate = vi.fn().mockRejectedValue(new Error("无权限"))
  window.electronAPI = { mutateWorkspaceFile: mutate } as unknown as Window["electronAPI"]
  render(<FileActions node={{ name: "a.md", path: "/vault/a.md", type: "file" }} onChanged={vi.fn()}><span>file</span></FileActions>)
  fireEvent.contextMenu(screen.getByText("file"))
  fireEvent.click(await screen.findByRole("button", { name: "移到废纸篓" }))
  expect(mutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "取消" }))
  expect(mutate).not.toHaveBeenCalled()
  fireEvent.contextMenu(screen.getByText("file"))
  fireEvent.click(await screen.findByRole("button", { name: "移到废纸篓" }))
  fireEvent.click(screen.getByRole("button", { name: "确认移到废纸篓" }))
  await waitFor(() => expect(mutate).toHaveBeenCalledWith("/vault", "/vault/a.md", undefined))
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("无权限"))
})
it("renames inline, preserves the extension and cancels without mutation", async () => {
  const mutate = vi.fn().mockResolvedValue('/vault/renamed.md')
  window.electronAPI = { mutateWorkspaceFile: mutate } as unknown as Window["electronAPI"]
  render(<FileActions node={{ name: "a.md", path: "/vault/a.md", type: "file" }} onChanged={vi.fn()}><span>file</span></FileActions>)
  fireEvent.contextMenu(screen.getByText('file'))
  fireEvent.click(await screen.findByRole('button', { name: '重命名' }))
  const input = screen.getByRole('textbox', { name: '文件新名称' })
  expect((input as HTMLInputElement).value).toBe('a')
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.change(input, { target: { value: 'renamed' } })
  fireEvent.blur(input)
  expect(mutate).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: '确认重命名' }))
  await waitFor(() => expect(mutate).toHaveBeenCalledWith('/vault', '/vault/a.md', 'renamed.md'))
  await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  fireEvent.contextMenu(screen.getByText('file'))
  fireEvent.click(await screen.findByRole('button', { name: '重命名' }))
  fireEvent.blur(screen.getByRole('textbox'))
  expect(screen.queryByRole('button', { name: '确认重命名' })).toBeNull()
  expect(mutate).toHaveBeenCalledTimes(1)
})
