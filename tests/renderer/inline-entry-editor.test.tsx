import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { InlineEntryEditor } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/create-entry/components/inline-entry-editor"

vi.mock("@/components/workspace/hooks/useWorkspace", () => ({ useWorkspace: () => ({ workspace: { path: "/vault" }, openWorkspaceFile: vi.fn() }) }))
afterEach(cleanup)

it.each(["md", "mind", "excalidraw.md", "js", "ts", "json", "jsx", "html", "css", "vue", ""])("creates a %s file with its fixed suffix", async (extension) => {
  const createWorkspaceEntry = vi.fn(async () => ({ path: "/vault/file" }))
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { createWorkspaceEntry, saveContent: vi.fn() } })
  render(<InlineEntryEditor draft={{ parent: "/vault", kind: "file", extension }} onFinish={vi.fn()} />)
  const input = screen.getByRole("textbox", { name: "新文件名称" })
  expect((input as HTMLInputElement).value).toBe(extension ? "未命名" : "")
  if (extension) expect(screen.getByLabelText("文件后缀").textContent).toBe(`.${extension}`)
  else expect(screen.queryByLabelText("文件后缀")).toBeNull()
  fireEvent.change(input, { target: { value: extension ? "测试" : "测试.custom" } })
  fireEvent.submit(input.closest("form")!)
  await waitFor(() => expect(createWorkspaceEntry).toHaveBeenCalledWith("/vault", "/vault", extension ? `测试.${extension}` : "测试.custom", "file"))
})

it("does not duplicate a suffix included when pasting the filename", async () => {
  const createWorkspaceEntry = vi.fn(async () => ({ path: "/vault/test.md" }))
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { createWorkspaceEntry } })
  render(<InlineEntryEditor draft={{ parent: "/vault", kind: "file", extension: "md" }} onFinish={vi.fn()} />)
  const input = screen.getByRole("textbox")
  fireEvent.change(input, { target: { value: "test.md" } })
  fireEvent.submit(input.closest("form")!)
  await waitFor(() => expect(createWorkspaceEntry).toHaveBeenCalledWith("/vault", "/vault", "test.md", "file"))
})
