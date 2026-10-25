import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { createMarkdownTableDocument, parseMarkdownTableDocument } from "@/components/core/canvas/variants/markdown-table/document"
import MarkdownTableCanvas from "@/components/core/canvas/variants/markdown-table"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("creates portable table JSON and rejects malformed documents", () => {
  const text = createMarkdownTableDocument("计划.markdowntable")
  const data = parseMarkdownTableDocument(text)
  expect(data.caption).toBe("计划")
  expect(data.columns).toHaveLength(3)
  expect(data.rows).toHaveLength(2)
  expect(data.rows.flatMap((row) => row.cells).every((cell) => cell.text === "")).toBe(true)
  expect(() => parseMarkdownTableDocument("not json")).toThrow()
  expect(() => parseMarkdownTableDocument('{"rows":123}')).toThrow()
})

it("loads a JSON file and autosaves edits as JSON without Markdown fences", async () => {
  const saveContent = vi.fn().mockResolvedValue(undefined)
  const existing = JSON.parse(createMarkdownTableDocument("计划.markdowntable"))
  existing.rows[0].cells[0].text = "原有内容"
  vi.stubGlobal("electronAPI", { readContent: vi.fn().mockResolvedValue(JSON.stringify(existing)), saveContent })
  render(<MarkdownTableCanvas activeFilePath="/workspace/计划.markdowntable" />)
  await screen.findByText("原有内容")
  fireEvent.doubleClick(screen.getByText("原有内容"))
  const input = screen.getByDisplayValue("原有内容")
  fireEvent.change(input, { target: { value: "名称" } })
  fireEvent.blur(input)
  await waitFor(() => expect(saveContent).toHaveBeenCalled())
  const [path, text] = saveContent.mock.calls.at(-1)!
  expect(path).toBe("/workspace/计划.markdowntable")
  expect(JSON.parse(text).rows[0].cells[0].text).toBe("名称")
})

it("never saves a malformed source file", async () => {
  const saveContent = vi.fn()
  vi.stubGlobal("electronAPI", { readContent: vi.fn().mockResolvedValue("broken json"), saveContent })
  render(<MarkdownTableCanvas activeFilePath="/workspace/broken.markdowntable" />)
  await screen.findByRole("alert")
  expect(saveContent).not.toHaveBeenCalled()
  expect(screen.queryByText("列 1")).toBeNull()
})

it("opens a cell context menu and inserts a column at the clicked cell", async () => {
  const saveContent = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("electronAPI", { readContent: vi.fn().mockResolvedValue(createMarkdownTableDocument("计划.markdowntable")), saveContent })
  render(<MarkdownTableCanvas activeFilePath="/workspace/计划.markdowntable" />)
  const cells = await screen.findAllByRole("columnheader")
  fireEvent.contextMenu(cells[1], { clientX: 120, clientY: 100 })
  const menu = screen.getByRole("menu", { name: "单元格操作" })
  expect(document.body.contains(menu)).toBe(true)
  expect(screen.getAllByRole("menuitem")).toHaveLength(6)
  fireEvent.click(screen.getByRole("menuitem", { name: "在右边插入一列" }))
  await waitFor(() => expect(saveContent).toHaveBeenCalled())
  expect(JSON.parse(saveContent.mock.calls.at(-1)![1]).columns).toHaveLength(4)
  expect(screen.queryByRole("menu")).toBeNull()
  fireEvent.contextMenu(screen.getAllByRole("columnheader")[0])
  fireEvent.keyDown(document, { key: "Escape" })
  expect(screen.queryByRole("menu")).toBeNull()
})
