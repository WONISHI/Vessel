import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { InlineEntryEditor } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/create-entry/components/inline-entry-editor"
import { FileIconScope } from "@/features/file-icons/state"

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

it.each(["md", "mind", "excalidraw.md"])("lets resource files edit the complete %s filename without forcing the template suffix", async (extension) => {
  const createWorkspaceEntry = vi.fn(async () => ({ path: "/vault/index.ts" }))
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { createWorkspaceEntry } })
  render(<FileIconScope.Provider value="resources"><InlineEntryEditor draft={{ parent: "/vault", kind: "file", extension }} onFinish={vi.fn()} /></FileIconScope.Provider>)
  const input = screen.getByRole("textbox", { name: "新文件名称" }) as HTMLInputElement
  expect(input.value).toBe(`未命名.${extension}`)
  expect(input.value.slice(input.selectionStart!, input.selectionEnd!)).toBe("未命名")
  expect(screen.queryByLabelText("文件后缀")).toBeNull()
  fireEvent.change(input, { target: { value: "index.ts" } })
  fireEvent.submit(input.closest("form")!)
  await waitFor(() => expect(createWorkspaceEntry).toHaveBeenCalledWith("/vault", "/vault", "index.ts", "file"))
})

it("creates a resource folder on submit and cancels an untouched draft on blur", async () => {
  const createWorkspaceEntry = vi.fn(async () => ({ path: "/vault/src" }))
  const finish = vi.fn()
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { createWorkspaceEntry } })
  const view = render(<FileIconScope.Provider value="resources"><InlineEntryEditor draft={{ parent: "/vault", kind: "directory", extension: "" }} onFinish={finish} /></FileIconScope.Provider>)
  const input = screen.getByRole("textbox", { name: "新文件夹名称" })
  fireEvent.change(input, { target: { value: "src" } })
  fireEvent.submit(input.closest("form")!)
  await waitFor(() => expect(finish).toHaveBeenCalledWith(true))
  expect(createWorkspaceEntry).toHaveBeenCalledWith("/vault", "/vault", "src", "directory")
  view.unmount()
  finish.mockClear()
  createWorkspaceEntry.mockClear()
  render(<FileIconScope.Provider value="resources"><InlineEntryEditor draft={{ parent: "/vault", kind: "file", extension: "" }} onFinish={finish} /></FileIconScope.Provider>)
  fireEvent.blur(screen.getByRole("textbox"))
  expect(finish).toHaveBeenCalledWith(false)
  expect(createWorkspaceEntry).not.toHaveBeenCalled()
})

it("cancels an edited resource name with Escape without creating it on blur", () => {
  const createWorkspaceEntry = vi.fn(), finish = vi.fn()
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { createWorkspaceEntry } })
  render(<FileIconScope.Provider value="resources"><InlineEntryEditor draft={{ parent: "/vault", kind: "file", extension: "" }} onFinish={finish} /></FileIconScope.Provider>)
  const input = screen.getByRole("textbox")
  fireEvent.change(input, { target: { value: "index.ts" } })
  fireEvent.keyDown(input, { key: "Escape" })
  fireEvent.blur(input)
  expect(finish).toHaveBeenCalledExactlyOnceWith(false)
  expect(createWorkspaceEntry).not.toHaveBeenCalled()
})
