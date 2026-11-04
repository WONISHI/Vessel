import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { LinkTooltip } from "@vessel/obsidian"

afterEach(cleanup)
it("renders the workspace link tooltip with the application's React runtime and confirms a URL", () => {
  const onConfirm = vi.fn()
  render(<LinkTooltip anchor={{ left: 100, top: 80 }} initialUrl="https://" initialText="链接文字" onConfirm={onConfirm} onClose={vi.fn()} />)
  expect(screen.getByRole("dialog", { name: "链接地址" }).querySelector("svg.vessel-link-tooltip-arrow path")).toBeTruthy()
  const input = screen.getByRole("textbox")
  fireEvent.change(input, { target: { value: "https://example.com" } })
  fireEvent.keyDown(input, { key: "Enter" })
  expect(onConfirm).toHaveBeenCalledWith("https://example.com", "链接文字")
})

it("keeps the input visible when a scrolled editor supplies an offscreen anchor", () => {
  render(<LinkTooltip anchor={{ left: 100, top: -3000, height: 0 }} onConfirm={vi.fn()} onClose={vi.fn()} />)
  const dialog = screen.getByRole("dialog", { name: "链接地址" })
  expect(parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(8)
  expect(parseFloat(dialog.style.top)).toBeLessThan(window.innerHeight)
})

it('keeps a bare URL verbatim and uses it as the label when no text was selected', () => {
  const onConfirm = vi.fn()
  render(<LinkTooltip anchor={{ left: 120, top: 180, width: 200, height: 22 }} onConfirm={onConfirm} onClose={vi.fn()} />)
  const dialog = screen.getByRole('dialog', { name: '链接地址' })
  expect(parseFloat(dialog.style.top) + 36).toBeLessThan(180)
  expect(parseFloat(dialog.style.left)).toBe(102)
  const arrow = dialog.querySelector<SVGElement>('.vessel-link-tooltip-arrow')!
  expect(parseFloat(dialog.style.left) + parseFloat(arrow.style.left) + 7).toBe(120)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'www.baidu.com' } })
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
  expect(onConfirm).toHaveBeenCalledWith('www.baidu.com', 'www.baidu.com')
})

it('does not insert an empty URL or confirm during IME composition', () => {
  const onConfirm = vi.fn()
  render(<LinkTooltip anchor={{ left: 100, top: 180 }} onConfirm={onConfirm} onClose={vi.fn()} />)
  const input = screen.getByRole('textbox')
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.change(input, { target: { value: 'www.baidu.com' } })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  expect(onConfirm).not.toHaveBeenCalled()
})
