import { afterEach, expect, it, vi } from "vitest"
import { formatTableCells } from "@/components/core/canvas/variants/markdown/table-format"
import { bindTablePaste } from "@/components/core/canvas/variants/markdown/table-paste"

afterEach(() => { document.body.replaceChildren(); window.getSelection()?.removeAllRanges() })
function fixture() {
  const root = document.createElement("div"), toolbar = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = '<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody><tr><td>one <em>two</em></td><td>three</td><td>keep</td></tr></tbody></table>'
  toolbar.innerHTML = '<button data-type="bold">bold</button><button data-type="center">center</button>'
  document.body.append(root, toolbar)
  return { root, toolbar, table: root.querySelector("table")! }
}
it("toggles bold across whole cells and preserves inline structure", () => {
  const { table } = fixture()
  const area = { table, top: 1, bottom: 1, left: 0, right: 1 }
  const bold = formatTableCells(area, "bold")
  expect(bold.rows[1].cells[0].innerHTML).toBe("<strong>one <em>two</em></strong>")
  expect(bold.rows[1].cells[1].innerHTML).toBe("<strong>three</strong>")
  expect(bold.rows[1].cells[2].innerHTML).toBe("keep")
  const reset = formatTableCells({ ...area, table: bold }, "bold")
  expect(reset.rows[1].cells[0].innerHTML).toBe("one <em>two</em>")
})
it("keeps a rectangular selection through toolbar pointerdown and aligns every selected Markdown column", () => {
  const { root, toolbar, table } = fixture()
  const stop = bindTablePaste(root, toolbar), command = vi.fn()
  Object.defineProperty(document, "execCommand", { configurable: true, value: command })
  try {
    table.rows[1].cells[0].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    table.rows[1].cells[1].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, shiftKey: true }))
    const button = toolbar.querySelector<HTMLElement>('[data-type="center"]')!
    button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, cancelable: true }))
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, cancelable: true }))
    button.click()
    expect(command).toHaveBeenCalledOnce()
    const replacement = new DOMParser().parseFromString(command.mock.calls[0][2], "text/html").querySelector("table")!
    for (const row of Array.from(replacement.rows)) {
      expect(row.cells[0].getAttribute("align")).toBe("center")
      expect(row.cells[1].getAttribute("align")).toBe("center")
      expect(row.cells[2].getAttribute("align")).toBeNull()
    }
  } finally { stop() }
})
it("bolds a caret's entire cell and leaves partial text selection to Vditor", () => {
  const { root, toolbar, table } = fixture()
  const stop = bindTablePaste(root, toolbar), command = vi.fn()
  Object.defineProperty(document, "execCommand", { configurable: true, value: command })
  const selection = window.getSelection()!, range = document.createRange(), text = table.rows[1].cells[1].firstChild!
  try {
    range.setStart(text, 0); range.collapse(true)
    selection.removeAllRanges(); selection.addRange(range)
    toolbar.querySelector<HTMLElement>('[data-type="bold"]')!.click()
    expect(command.mock.calls[0][2]).toContain("<strong>three</strong>")
    command.mockClear()
    range.setStart(text, 0); range.setEnd(text, 2)
    selection.removeAllRanges(); selection.addRange(range)
    const native = vi.fn()
    toolbar.querySelector<HTMLElement>('[data-type="bold"]')!.addEventListener("click", native)
    toolbar.querySelector<HTMLElement>('[data-type="bold"]')!.click()
    expect(command).not.toHaveBeenCalled()
    expect(native).toHaveBeenCalledOnce()
    expect(selection.toString()).toBe("th")
  } finally { stop() }
})
