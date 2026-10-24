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
