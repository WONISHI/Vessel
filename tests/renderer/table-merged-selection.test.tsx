import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { MarkdownTableEditor, parseMarkdownTable } from "@vessel/markdown-table"
import { expandRangeToMerges } from "../../packages/@vessel/markdown-table/src/merge-utils"

afterEach(cleanup)
it("draws all four selection edges around a vertically merged cell", () => {
  const data = parseMarkdownTable(JSON.stringify({ columns: [{}, {}, {}], rows: [
    { isHeader: true, cells: [{text:"A"},{text:"B"},{text:"C"}] },
    ...["edit", "readonly", "preview", "other"].map((text, i) => ({ cells: [{text:i === 0 ? "state" : ""},{text},{text:"explanation"}] }))
  ] }))
  data.merges = [{ startRow: 1, endRow: 3, startCol: 0, endCol: 0 }]
  const { container } = render(<MarkdownTableEditor data={data} />)
  const merged = container.querySelector('td[rowspan="3"]')!
  fireEvent.mouseDown(merged, { button: 0 })
  fireEvent.mouseUp(merged)
  expect(merged.className).toContain("vessel-sel-bottom")
  for (const edge of ["top", "bottom", "left", "right"]) expect(merged.className).toContain("vessel-sel-" + edge)
  const nextCell = container.querySelectorAll("tbody tr")[2].querySelector("td")!
  expect(nextCell.className).not.toContain("vessel-cell-edge-left")
})
it("expands a selection through merges intersected by another merged footprint", () => {
  expect(expandRangeToMerges({ startRow: 1, endRow: 1, startCol: 0, endCol: 1 }, [
    { startRow: 1, endRow: 3, startCol: 0, endCol: 0 }, { startRow: 3, endRow: 4, startCol: 1, endCol: 2 }
  ])).toEqual({ startRow: 1, endRow: 4, startCol: 0, endCol: 2 })
})

it("dismisses the cell menu when another cell intercepts the mouse event", () => {
  const data = parseMarkdownTable(JSON.stringify({ columns: [{}, {}], rows: [{ cells: [{ text: "A" }, { text: "B" }] }, { cells: [{ text: "one" }, { text: "two" }] }] }))
  const { container, queryByRole, getByRole } = render(<div onMouseDown={event => event.stopPropagation()}><MarkdownTableEditor data={data} /></div>)
  const cells = container.querySelectorAll("td,th")
  fireEvent.contextMenu(cells[0], { clientX: 40, clientY: 40 })
  expect(getByRole("menu", { name: "单元格操作" })).toBeTruthy()
  fireEvent.mouseDown(cells[1], { button: 0 })
  expect(queryByRole("menu", { name: "单元格操作" })).toBeNull()
})
