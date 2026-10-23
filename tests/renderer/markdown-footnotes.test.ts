import { decorateInlineHTML } from "@/components/core/canvas/variants/markdown/inline-html"
import { afterEach, expect, it, vi } from "vitest"
import { createRequire } from "node:module"
import type Vditor from "vditor"
import { bindFootnoteToolbar, deleteFootnote, insertFootnote, nextFootnoteId, validFootnoteRange } from "@/components/core/canvas/variants/markdown/footnotes"
const require = createRequire(import.meta.url)
require("vditor/dist/js/lute/lute.min.js")
const lute = (globalThis as any).Lute.New()

afterEach(() => {
  window.getSelection()?.removeAllRanges()
  document.body.replaceChildren()
})
function fixture(html = "<p>交集是两个集合共同的元素。</p>") {
  const host = document.createElement("div")
  host.innerHTML = `<div class="vditor-ir"><pre class="vditor-reset" contenteditable="true">${html}</pre></div>`
  document.body.append(host)
  const editable = host.querySelector<HTMLElement>('[contenteditable="true"]')!
  editable.tabIndex = 0
  const select = (node: Node, start = 0, end = node.textContent!.length) => {
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, end)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event("selectionchange"))
    return range
  }
  return { host, editable, select }
}

it("keeps the toolbar item visible and enables it only for selected document text", () => {
  const { host, editable, select } = fixture()
  const toolbar = document.createElement("div")
  toolbar.innerHTML = '<div class="vditor-toolbar__item"><button data-type="footnote">脚注</button></div>'
  document.body.append(toolbar)
  const callback = vi.fn()
  const dispose = bindFootnoteToolbar(host, toolbar, callback)
  const item = toolbar.firstElementChild as HTMLElement
  const button = toolbar.querySelector("button")!
  expect(item.hidden).toBe(false)
  expect(button.disabled).toBe(true)
  const range = select(editable.querySelector("p")!.firstChild!, 2, 8)
  expect(item.hidden).toBe(false)
  expect(button.disabled).toBe(false)
  expect(button.dispatchEvent(new MouseEvent("mousedown", { cancelable: true }))).toBe(false)
  button.click()
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback.mock.calls[0][0].toString()).toBe(range.toString())
  window.getSelection()?.collapseToEnd()
  document.dispatchEvent(new Event("selectionchange"))
  expect(item.hidden).toBe(false)
  expect(button.disabled).toBe(true)
  dispose()
})

it("rejects code, images, mixed ranges, whitespace and selections outside this editor", () => {
  const { host, editable, select } = fixture('<p>正文</p><div data-type="code-block"><pre><code>const value = 1</code></pre></div><p><img src="image.png" alt="图片" />图片后</p>')
  expect(validFootnoteRange(host, select(editable.querySelector("code")!.firstChild!))).toBe(false)
  const imageRange = document.createRange()
  imageRange.selectNode(editable.querySelector("img")!)
  expect(validFootnoteRange(host, imageRange)).toBe(false)
  const mixed = document.createRange()
  mixed.setStart(editable.querySelector("p")!.firstChild!, 0)
  mixed.setEnd(editable.lastElementChild!.lastChild!, 3)
  expect(validFootnoteRange(host, mixed)).toBe(false)
  const outside = document.createElement("p")
  outside.textContent = "外部文字"
  document.body.append(outside)
  expect(validFootnoteRange(host, select(outside.firstChild!))).toBe(false)
  const blank = document.createTextNode("   ")
  editable.append(blank)
  expect(validFootnoteRange(host, select(blank))).toBe(false)
})

it("inserts a standard reference after the selection, preserves text and appends a Lute footnote definition", () => {
  const { host, editable, select } = fixture("<p>前文<strong>选中文字</strong>后文</p>")
  const range = select(editable.querySelector("strong")!.firstChild!)
  const before = lute.VditorIRDOM2Md(editable.innerHTML)
  const undo = vi.fn()
  const setValue = vi.fn()
  const insertValue = vi.fn((value: string) => {
    const caret = window.getSelection()!.getRangeAt(0)
    caret.insertNode(document.createTextNode(value))
    editable.innerHTML = lute.SpinVditorIRDOM(editable.innerHTML)
  })
  const editor = { getValue: () => before, setValue, insertValue, vditor: { lute, undo: { addToUndoStack: undo } } } as unknown as Vditor
  expect(insertFootnote(editor, host, range, "选中文字", "这是脚注说明\n第二行")).toBe(true)
  const markdown = lute.VditorIRDOM2Md(editable.innerHTML)
  expect(markdown).toContain("选中文字")
  expect(markdown).toContain("后文")
  expect(markdown).toContain("[^1]")
  expect(markdown).toContain("[^1]:")
  expect(markdown).toContain("这是脚注说明")
  expect(markdown).toContain("第二行")
  expect(markdown).toContain('data-vessel-footnote="1"')
  decorateInlineHTML(editable)
  expect(editable.querySelector('[data-vessel-footnote-id="1"]')?.textContent).toBe("选中文字")
  expect(insertValue).toHaveBeenCalledWith("[^1]", true)
  expect(setValue).not.toHaveBeenCalled()
  expect(undo).toHaveBeenCalledTimes(1)
})

it("does not overwrite stale selections or reuse existing footnote labels", () => {
  expect(nextFootnoteId("正文[^1] 和[^2]\n\n[^1]: 已存在")).toBe("3")
  const { host, editable, select } = fixture()
  const range = select(editable.querySelector("p")!.firstChild!)
  const editor = { getValue: vi.fn(), insertValue: vi.fn() } as unknown as Vditor
  expect(insertFootnote(editor, host, range, "已变化的内容", "说明")).toBe(false)
  expect(editor.insertValue).not.toHaveBeenCalled()
})

it("keeps earlier footnotes when adding another definition", () => {
  const { host, editable, select } = fixture(lute.Md2VditorIRDOM("正文[^1]，新的文字\n\n[^1]: 原来的脚注"))
  const text = Array.from(editable.querySelector("p")!.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes("新的文字"))!
  const range = select(text, text.textContent!.indexOf("新的文字"), text.textContent!.indexOf("新的文字") + 4)
  const editor = {
    getValue: () => lute.VditorIRDOM2Md(editable.innerHTML),
    vditor: { lute },
    insertValue: (value: string) => {
      window.getSelection()!.getRangeAt(0).insertNode(document.createTextNode(value))
      editable.innerHTML = lute.SpinVditorIRDOM(editable.innerHTML)
    }
  } as unknown as Vditor
  expect(insertFootnote(editor, host, range, "新的文字", "新增的脚注")).toBe(true)
  const markdown = lute.VditorIRDOM2Md(editable.innerHTML)
  expect(markdown).toContain("原来的脚注")
  expect(markdown).toContain("新增的脚注")
  expect(markdown).toContain("[^1]:")
  expect(markdown).toContain("[^2]:")
})

it("deletes only the requested footnote and preserves its text and other notes", () => {
  const { host, editable } = fixture(lute.Md2VditorIRDOM('前文<span data-vessel-footnote="1">选中文字</span>[^1]后文[^2]\n\n[^1]: 删除的说明\n\n[^2]: 保留的说明'))
  decorateInlineHTML(editable)
  const undo = vi.fn()
  const editor = {
    vditor: { lute, undo: { addToUndoStack: undo } },
    insertValue: vi.fn(() => {
      editable.innerHTML = lute.SpinVditorIRDOM(editable.innerHTML)
    })
  } as unknown as Vditor
  expect(deleteFootnote(editor, host, "1")).toBe(true)
  const markdown = lute.VditorIRDOM2Md(editable.innerHTML)
  expect(markdown).toContain("前文选中文字后文")
  expect(markdown).not.toContain("[^1]")
  expect(markdown).not.toContain("data-vessel-footnote")
  expect(markdown).not.toContain("删除的说明")
  expect(markdown).toContain("[^2]: 保留的说明")
  expect(undo).toHaveBeenCalledTimes(1)
  expect(editor.insertValue).toHaveBeenCalledWith("", true)
  expect(deleteFootnote(editor, host, "missing")).toBe(false)
})
