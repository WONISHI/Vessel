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

it("edits cells in a one-row textarea and preserves multiline text on save", async () => {
  const saveContent = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("electronAPI", { readContent: vi.fn().mockResolvedValue(createMarkdownTableDocument()), saveContent })
  render(<MarkdownTableCanvas activeFilePath="/workspace/表格.markdowntable" />)
  fireEvent.doubleClick((await screen.findAllByRole("columnheader"))[0])
  const editor = screen.getByRole("combobox") as HTMLTextAreaElement
  expect(editor.tagName).toBe("TEXTAREA")
  expect(editor.rows).toBe(1)
  const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
  fireEvent(editor, enter)
  expect(enter.defaultPrevented).toBe(false)
  expect(screen.getByRole("combobox")).toBe(editor)
  fireEvent.change(editor, { target: { value: "第一行\n第二行" } })
  await waitFor(() => expect(JSON.parse(saveContent.mock.calls.at(-1)![1]).rows[0].cells[0].text).toBe("第一行\n第二行"))
  fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true })
  expect(screen.queryByRole("combobox")).toBeNull()
  fireEvent.doubleClick(screen.getAllByRole("columnheader")[0])
  expect((screen.getByRole("combobox") as HTMLTextAreaElement).value).toBe("第一行\n第二行")
})

it("converts selected cells to tasks, persists completion, and removes task formatting without losing text", async () => {
  const document = JSON.parse(createMarkdownTableDocument())
  document.rows[1].cells[0].text = "任务一\n任务二"
  document.rows[1].cells[1].text = "任务三"
  const saveContent = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("electronAPI", { readContent: vi.fn().mockResolvedValue(JSON.stringify(document)), saveContent })
  render(<MarkdownTableCanvas activeFilePath="/workspace/任务.markdowntable" />)
  const first = (await screen.findByText("任务一")).closest("td")!
  const second = screen.getByText("任务三").closest("td")!
  fireEvent.mouseDown(first, { button: 0 })
  fireEvent.mouseUp(first)
  fireEvent.mouseDown(second, { button: 0, shiftKey: true })
  fireEvent.mouseUp(second)
  fireEvent.click(screen.getByRole("button", { name: "任务列表" }))
  expect(screen.getAllByRole("checkbox")).toHaveLength(3)
  fireEvent.click(screen.getByRole("checkbox", { name: "任务二" }))
  await waitFor(() => expect(JSON.parse(saveContent.mock.calls.at(-1)![1]).rows[1].cells[0].text).toBe("- [ ] 任务一\n- [x] 任务二"))
  expect((screen.getByRole("checkbox", { name: "任务二" }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "任务列表" }))
  expect(screen.queryByRole("checkbox")).toBeNull()
  await waitFor(() => expect(JSON.parse(saveContent.mock.calls.at(-1)![1]).rows[1].cells[0].text).toBe("任务一\n任务二"))
})

it("appends rows and columns from the table edge controls and saves their dimensions", async () => {
  const saveContent = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("electronAPI", { readContent: vi.fn().mockResolvedValue(createMarkdownTableDocument("表格.markdowntable")), saveContent })
  render(<MarkdownTableCanvas activeFilePath="/workspace/表格.markdowntable" />)
  const bottom = await screen.findByRole("button", { name: "在表格底部新增行" })
  fireEvent.mouseEnter(bottom)
  expect(screen.getByRole("tooltip").textContent).toBe("在下方新增行")
  expect(bottom.hasAttribute("title")).toBe(false)
  fireEvent.mouseLeave(bottom)
  expect(screen.queryByRole("tooltip")).toBeNull()
  fireEvent.click(bottom)
  await waitFor(() => expect(JSON.parse(saveContent.mock.calls.at(-1)![1]).rows).toHaveLength(3))
  fireEvent.click(screen.getByRole("button", { name: "在表格右侧新增列" }))
  await waitFor(() => expect(JSON.parse(saveContent.mock.calls.at(-1)![1]).columns).toHaveLength(4))
  expect(JSON.parse(saveContent.mock.calls.at(-1)![1]).rows.every((row: any) => row.cells.length === 4)).toBe(true)
})
