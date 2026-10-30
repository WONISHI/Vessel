import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { MarkdownTableEditor } from "@vessel/markdown-table"
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it("resizes neighboring columns and persists widths only on release", () => {
  vi.stubGlobal("PointerEvent", MouseEvent)
  const change = vi.fn()
  const { container } = render(<MarkdownTableEditor source="| A | B |\n| --- | --- |\n| x | y |" onChange={change} />)
  container.querySelectorAll("col").forEach((col) => vi.spyOn(col, "getBoundingClientRect").mockReturnValue({ width: 200 } as DOMRect))
  const handle = screen.getByRole("separator", { name: "调整第 1 列宽度" })
  handle.setPointerCapture = vi.fn(); handle.releasePointerCapture = vi.fn()
  fireEvent.pointerDown(handle, { button: 0, clientX: 200, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientX: 250, pointerId: 1 })
  expect(change).not.toHaveBeenCalled()
  fireEvent.pointerUp(handle, { pointerId: 1 })
  expect(change.mock.calls[0][1].columns.map((column: any) => column.width)).toEqual([250, 150, 200])
  const widths = Array.from(container.querySelectorAll("col"), (column) => parseFloat(column.style.width))
  expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100)
  expect(widths[0]).toBeCloseTo(250 / 600 * 100)
})
it("retains invalid JSON in the source editor instead of replacing the table", () => {
  const change = vi.fn()
  render(<MarkdownTableEditor onChange={change} renderRawEditor={({ value, onChange }) => <textarea aria-label="JSON source" value={value} onChange={(event) => onChange(event.target.value)} />} />)
  fireEvent.click(screen.getByRole("button", { name: /JSON/ }))
  fireEvent.change(screen.getByRole("textbox", { name: "JSON source" }), { target: { value: '{"columns":' } })
  fireEvent.click(screen.getByRole("button", { name: /表格/ }))
  expect(screen.getByRole("alert").textContent).toContain("JSON 无效")
  expect(screen.getByRole("textbox", { name: "JSON source" })).toBeTruthy()
  expect(change).not.toHaveBeenCalled()
})
it("does not expose resize handles in read-only tables", () => {
  render(<MarkdownTableEditor source="| A | B |\n| --- | --- |\n| x | y |" readOnly />)
  expect(screen.queryByRole("separator", { name: /调整第/ })).toBeNull()
})
