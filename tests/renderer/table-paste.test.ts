// @vitest-environment jsdom
import { expect, it, vi } from "vitest"
import { clipboardCells, fillTable, bindTablePaste } from "@/components/core/canvas/variants/markdown/table-paste"
it("preserves empty cells in markdown and quoted TSV", () => {
  expect(clipboardCells("| | | url-a |\n| --- | --- | --- |\n| | code | url-b |")).toEqual([
    ["", "", "url-a"],
    ["", "code", "url-b"]
  ])
  expect(clipboardCells('\t"line\none"\t\n\tvalue\t')).toEqual([
    ["", "line\none", ""],
    ["", "value", ""]
  ])
  expect(clipboardCells("| a\\|b | c |\n| --- | --- |")).toEqual([["a|b", "c"]])
  expect(clipboardCells("const x = 1;\nnext()")).toBeNull()
})
it("fills from the selected cell, grows dimensions and retains other cells", () => {
  const table = document.createElement("table")
  table.innerHTML = "<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>keep</td><td>old</td></tr></tbody>"
  const filled = fillTable(table, 1, 1, [
    ["", "<script>unsafe</script>"],
    ["second", "last"]
  ])
  expect(filled.rows.length).toBe(3)
  expect(filled.rows[0].cells.length).toBe(3)
  expect(filled.rows[1].cells[0].textContent).toBe("keep")
  expect(filled.rows[1].cells[1].textContent).toBe("")
  expect(filled.querySelector("script")).toBeNull()
  expect(filled.rows[2].cells[2].textContent).toBe("last")
  expect(table.rows.length).toBe(2)
})
it("copies a shift-selected rectangle and pastes it as one editor edit", () => {
  const root = document.createElement("div")
  root.contentEditable = "true"
  root.innerHTML = "<table><tbody><tr><td></td><td>x</td></tr><tr><td>y</td><td>z</td></tr></tbody></table>"
  document.body.append(root)
  const clean = bindTablePaste(root)
  const cells = root.querySelectorAll("td")
  cells[0].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
  cells[3].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, shiftKey: true }))
  const data = new Map<string, string>()
  const clipboardData = { files: [], setData: (type: string, value: string) => data.set(type, value), getData: (type: string) => data.get(type) || "" }
  const copy = new Event("copy", { bubbles: true, cancelable: true })
  Object.defineProperty(copy, "clipboardData", { value: clipboardData })
  cells[0].dispatchEvent(copy)
  expect(data.get("text/plain")).toBe("\tx\ny\tz")
  expect(clipboardCells("", data.get("text/html"))).toEqual([
    ["", "x"],
    ["y", "z"]
  ])
  const range = document.createRange()
  range.selectNodeContents(cells[0])
  range.collapse(true)
  window.getSelection()!.removeAllRanges()
  window.getSelection()!.addRange(range)
  const insert = vi.fn()
  Object.defineProperty(document, "execCommand", { configurable: true, value: insert })
  const paste = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(paste, "clipboardData", { value: clipboardData })
  cells[0].dispatchEvent(paste)
  expect(insert).toHaveBeenCalledTimes(1)
  expect(insert.mock.calls[0][0]).toBe("insertHTML")
  expect(insert.mock.calls[0][2]).toContain("<table>")
  clean()
  root.remove()
  expect(document.querySelector(".vessel-table-cell-selection")).toBeNull()
})

it("clears only drag-selected cells with Delete as one undoable edit", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = "<table><tbody><tr><td>keep</td><td>A</td><td>B</td></tr><tr><td>also keep</td><td>C</td><td>D</td></tr></tbody></table>"
  document.body.append(root)
  const unbind = bindTablePaste(root)
  const cells = root.querySelectorAll("td")
  const insert = vi.fn()
  Object.defineProperty(document, "execCommand", { configurable: true, value: insert })
  try {
    const single = new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true })
    cells[0].dispatchEvent(single)
    expect(single.defaultPrevented).toBe(false)
    cells[1].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    cells[5].dispatchEvent(new MouseEvent("pointermove", { bubbles: true, button: 0 }))
    document.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }))
    const event = new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true })
    cells[1].dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(insert).toHaveBeenCalledTimes(1)
    const table = new DOMParser().parseFromString(insert.mock.calls[0][2], "text/html").querySelector("table")!
    expect(Array.from(table.rows, (row) => Array.from(row.cells, (cell) => cell.textContent))).toEqual([["keep", "", ""], ["also keep", "", ""]])
    expect(document.querySelector(".vessel-table-cell-selection")).toBeNull()
  } finally { unbind(); root.remove() }
})

it("keeps column selection separate from native text selection in neighboring columns", () => {
  const root = document.createElement("div")
  root.innerHTML = "<table><tbody><tr><td>left A</td><td></td></tr><tr><td>left B</td><td></td></tr></tbody></table>"
  document.body.append(root)
  const unbind = bindTablePaste(root)
  const cells = root.querySelectorAll("td")
  const selection = window.getSelection()!
  try {
    cells[1].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    cells[3].dispatchEvent(new MouseEvent("pointermove", { bubbles: true, button: 0 }))
    const range = document.createRange()
    range.setStart(cells[1], 0)
    range.setEnd(cells[3], 0)
    selection.removeAllRanges()
    selection.addRange(range)
    expect(selection.toString()).toContain("left B")
    document.dispatchEvent(new Event("selectionchange"))
    expect(selection.isCollapsed).toBe(true)
    expect(document.querySelectorAll(".vessel-table-cell-selection")).toHaveLength(2)
    const start = new Event("selectstart", { bubbles: true, cancelable: true })
    cells[3].dispatchEvent(start)
    expect(start.defaultPrevented).toBe(true)
    cells[0].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    const nativeStart = new Event("selectstart", { bubbles: true, cancelable: true })
    cells[0].dispatchEvent(nativeStart)
    expect(nativeStart.defaultPrevented).toBe(false)
  } finally { unbind(); root.remove(); selection.removeAllRanges() }
})
