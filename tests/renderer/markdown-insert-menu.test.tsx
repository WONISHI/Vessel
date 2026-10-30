import { configureBodyLute } from "@/components/core/canvas/variants/markdown/body-lute"
import { createRequire } from "node:module"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { MarkdownInsertMenu } from "@/components/core/canvas/variants/markdown/insert-menu"
import { bindMarkdownInsertMenu } from "@/components/core/canvas/variants/markdown/insert-menu-selection"

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.innerHTML = "" })
it("offers six heading levels and inserts the selected Markdown heading", async () => {
  const insert = vi.fn()
  render(<MarkdownInsertMenu x={100} y={100} onClose={vi.fn()} onInsert={insert} />)
  const item = screen.getByRole("menuitem", { name: "插入标题" })
  item.focus()
  fireEvent.keyDown(item, { key: "ArrowRight" })
  const heading = await screen.findByRole("menuitem", { name: /三级标题/ })
  expect(screen.getByRole("menuitem", { name: /六级标题/ })).toBeTruthy()
  fireEvent.click(heading)
  expect(insert).toHaveBeenCalledWith("### 标题", false)
})
it("inserts timeline and steps as their supported fenced languages", async () => {
  const insert = vi.fn()
  const view = render(<MarkdownInsertMenu x={100} y={100} onClose={vi.fn()} onInsert={insert} />)
  const item = screen.getByRole("menuitem", { name: "添加组件" })
  item.focus()
  fireEvent.keyDown(item, { key: "ArrowRight" })
  fireEvent.click(await screen.findByRole("menuitem", { name: "时间线" }))
  expect(insert.mock.calls[0][0]).toMatch(/^```timeline\n- /)
  view.unmount()
  render(<MarkdownInsertMenu x={100} y={100} onClose={vi.fn()} onInsert={insert} />)
  const second = screen.getByRole("menuitem", { name: "添加组件" })
  second.focus()
  fireEvent.keyDown(second, { key: "ArrowRight" })
  fireEvent.click(await screen.findByRole("menuitem", { name: "步骤条" }))
  expect(insert.mock.calls[1][0]).toMatch(/^```steps\n1\. /)
})
it("captures the clicked caret and leaves tables and readonly content alone", () => {
  const root = document.createElement("div")
  root.innerHTML = '<div class="vditor-ir"><div contenteditable="true"><p>文本</p><table><tbody><tr><td>单元格</td></tr></tbody></table><div contenteditable="false">预览</div></div></div>'
  document.body.append(root)
  const range = document.createRange()
  range.setStart(root.querySelector("p")!.firstChild!, 1)
  range.collapse(true)
  Object.defineProperty(document, "caretRangeFromPoint", { configurable: true, value: () => range })
  const open = vi.fn()
  const unbind = bindMarkdownInsertMenu(root, open)
  fireEvent.contextMenu(root.querySelector("p")!, { clientX: 25, clientY: 40 })
  expect(open).toHaveBeenCalledOnce()
  expect(open.mock.calls[0][0].range.startOffset).toBe(1)
  expect(open.mock.calls[0][0].x).toBe(25)
  fireEvent.contextMenu(root.querySelector("td")!)
  fireEvent.contextMenu(root.querySelector('[contenteditable="false"]')!)
  expect(open).toHaveBeenCalledOnce()
  unbind()
  fireEvent.contextMenu(root.querySelector("p")!)
  expect(open).toHaveBeenCalledOnce()
})

it("triggers insert menu upon typing slash in editable markdown", () => {
  const root = document.createElement("div")
  root.innerHTML = '<div class="vditor-ir"><pre class="vditor-reset" contenteditable="true"><p>/</p></pre></div>'
  document.body.append(root)
  const textNode = root.querySelector("p")!.firstChild!
  const range = document.createRange()
  range.setStart(textNode, 1)
  range.collapse(true)
  window.getSelection()?.removeAllRanges()
  window.getSelection()?.addRange(range)

  const open = vi.fn()
  const unbind = bindMarkdownInsertMenu(root, open)

  vi.useFakeTimers()
  fireEvent(root.querySelector('[contenteditable="true"]')!, new InputEvent("input", { data: "/", bubbles: true }))
  vi.runAllTimers()
  vi.useRealTimers()
  expect(open).toHaveBeenCalledOnce()
  expect(open.mock.calls[0][0].range.startOffset).toBe(0)
  expect(open.mock.calls[0][0].range.endOffset).toBe(1)
  unbind()
})


it("inserts a thematic break instead of a YAML frontmatter block", () => {
  const insert = vi.fn()
  render(<MarkdownInsertMenu x={100} y={100} onClose={vi.fn()} onInsert={insert} />)
  fireEvent.click(screen.getByRole("menuitem", { name: "插入分割线" }))
  expect(insert).toHaveBeenCalledWith("***", false)
  const require = createRequire(import.meta.url)
  require("vditor/dist/js/lute/lute.min.js")
  const lute = (globalThis as any).Lute.New()
  configureBodyLute(lute)
  const host = document.createElement("div")
  host.innerHTML = lute.Md2VditorIRDOM(`\n\n${insert.mock.calls[0][0]}\n\n`)
  // Vditor spins its DOM after insertion and serializes rules as `---` on save.
  host.innerHTML = lute.SpinVditorIRDOM(host.innerHTML)
  host.innerHTML = lute.Md2VditorIRDOM(lute.VditorIRDOM2Md(host.innerHTML))
  host.innerHTML = lute.SpinVditorIRDOM(host.innerHTML)
  expect(host.querySelector("hr")).toBeTruthy()
  expect(host.querySelector('[data-type="yaml-front-matter"], pre')).toBeNull()
})

it("inserts an expanded Obsidian callout from the component submenu", async () => {
  const insert = vi.fn()
  render(<MarkdownInsertMenu x={100} y={100} onClose={vi.fn()} onInsert={insert} />)
  const item = screen.getByRole("menuitem", { name: "添加组件" })
  item.focus()
  fireEvent.keyDown(item, { key: "ArrowRight" })
  const callout = await screen.findByRole("menuitem", { name: "Callout 标注" })
  callout.focus()
  fireEvent.keyDown(callout, { key: "ArrowRight" })
  for (const label of ["备注", "摘要", "信息", "待办", "技巧", "成功", "疑问", "警告", "失败", "危险", "缺陷", "示例", "引用"]) {
    expect(screen.getAllByRole("menuitem", { name: label }).length).toBeGreaterThan(0)
  }
  fireEvent.click(await screen.findByRole("menuitem", { name: "备注" }))
  expect(insert).toHaveBeenCalledWith("> [!note]+ 标题\n> 标注内容", false)
})

it("inserts the selected warning alias instead of a default note", async () => {
  const insert = vi.fn()
  render(<MarkdownInsertMenu x={100} y={100} onClose={vi.fn()} onInsert={insert} />)
  const components = screen.getByRole("menuitem", { name: "添加组件" })
  components.focus()
  fireEvent.keyDown(components, { key: "ArrowRight" })
  const callout = await screen.findByRole("menuitem", { name: "Callout 标注" })
  callout.focus()
  fireEvent.keyDown(callout, { key: "ArrowRight" })
  fireEvent.click(await screen.findByRole("menuitem", { name: "警告" }))
  expect(insert).toHaveBeenCalledWith("> [!caution]+ 标题\n> 标注内容", false)
})
