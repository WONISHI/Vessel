import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { wikiCompletionAt } from "@vessel/obsidian"
import MarkdownTableCanvas from "@/components/core/canvas/variants/markdown-table"
import { createMarkdownTableDocument } from "@/components/core/canvas/variants/markdown-table/document"
import { WorkspaceContext, type WorkspaceContextType } from "@/components/workspace/types/workspace"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("detects a partial wikilink and replaces existing brackets without touching surrounding text", () => {
  expect(wikiCompletionAt("前面[[关键]]后面", 6)).toEqual({ start: 2, end: 8, query: "关键" })
  expect(wikiCompletionAt("普通文字", 4)).toBeNull()
  expect(wikiCompletionAt("![[图片", 5)).toBeNull()
  expect(wikiCompletionAt("[[文件]]", 6)).toBeNull()
})

it("suggests matching files inside a table cell, inserts a wikilink and opens its target", async () => {
  const saveContent = vi.fn().mockResolvedValue(undefined)
  const readWikiLink = vi.fn().mockResolvedValue({ path: "/vault/笔记/Python.md", content: "" })
  const open = vi.fn()
  vi.stubGlobal("electronAPI", {
    readContent: vi.fn().mockResolvedValue(createMarkdownTableDocument("表格.markdowntable")),
    saveContent,
    readWikiLink,
    readWorkspaceDirectory: vi.fn().mockImplementation(async (_root, path) =>
      path === "/vault"
        ? [{ name: "笔记", path: "/vault/笔记", type: "directory" }]
        : [
            { name: "Python.md", path: "/vault/笔记/Python.md", type: "file" },
            { name: "Java.md", path: "/vault/笔记/Java.md", type: "file" }
          ]
    )
  })
  const context = { workspace: { path: "/vault", name: "资料", files: [] }, openWorkspaceFile: open } as unknown as WorkspaceContextType
  render(
    <WorkspaceContext.Provider value={context}>
      <MarkdownTableCanvas
        activeFilePath="/vault/表格.markdowntable"
        workspacePath="/vault"
      />
    </WorkspaceContext.Provider>
  )
  const cells = await screen.findAllByRole("columnheader")
  fireEvent.doubleClick(cells[0])
  const input = screen.getByRole("combobox") as HTMLInputElement
  fireEvent.change(input, { target: { value: "[[py]]", selectionStart: 4 } })
  await screen.findByRole("option", { name: /Python/ })
  expect(screen.queryByRole("option", { name: /Java/ })).toBeNull()
  fireEvent.keyDown(input, { key: "ArrowDown" })
  fireEvent.keyDown(input, { key: "Enter" })
  await waitFor(() => expect(input.value).toBe("[[笔记/Python.md]]"))
  expect(screen.queryByRole("listbox")).toBeNull()
  await waitFor(() => expect(JSON.parse(saveContent.mock.calls.at(-1)![1]).rows[0].cells[0].text).toBe("[[笔记/Python.md]]"))
  fireEvent.blur(input)
  fireEvent.click(screen.getByRole("button", { name: "Python" }))
  await waitFor(() => expect(open).toHaveBeenCalledWith({ name: "Python.md", path: "/vault/笔记/Python.md", type: "file" }))
  expect(readWikiLink).toHaveBeenCalledWith("/vault", "笔记/Python.md")
})

it("searches all workspace files and lazily reveals results beyond the first page", async () => {
  const files = Array.from({ length: 65 }, (_, i) => ({ name: `note-${String(i).padStart(2, "0")}.md`, path: `/vault/note-${String(i).padStart(2, "0")}.md`, type: "file" }))
  vi.stubGlobal("electronAPI", {
    readContent: vi.fn().mockResolvedValue(createMarkdownTableDocument()), saveContent: vi.fn().mockResolvedValue(undefined),
    readWorkspaceDirectory: vi.fn().mockImplementation(async (_root, path) => path === "/vault" ? [...files.slice(0, 40), { name: "nested", path: "/vault/nested", type: "directory" }] : files.slice(40))
  })
  render(<MarkdownTableCanvas activeFilePath="/vault/table.markdowntable" workspacePath="/vault" />)
  fireEvent.doubleClick((await screen.findAllByRole("columnheader"))[0])
  const input = screen.getByRole("combobox")
  fireEvent.change(input, { target: { value: "[[", selectionStart: 2 } })
  await screen.findByRole("option", { name: /note-00/ })
  expect(screen.getAllByRole("option")).toHaveLength(30)
  for (let i = 0; i < 31; i++) fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(screen.getByRole("option", { name: /note-31/ }).getAttribute("aria-selected")).toBe("true")
  expect(screen.getAllByRole("option").length).toBeGreaterThan(30)
  fireEvent.change(input, { target: { value: "[[note-64", selectionStart: 9 } })
  await screen.findByRole("option", { name: /note-64/ })
  expect(screen.getAllByRole("option")).toHaveLength(1)
})
