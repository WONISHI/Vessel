import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { CodeLanguageDialog } from "@/components/core/canvas/variants/markdown/code-language-dialog"

afterEach(cleanup)
it("filters languages and applies the draft only on confirmation", () => {
  const confirm = vi.fn()
  render(<CodeLanguageDialog value="text" onClose={vi.fn()} onConfirm={confirm} />)
  fireEvent.change(screen.getByRole("textbox", { name: "搜索语言" }), { target: { value: "typescript" } })
  expect(screen.queryByRole("option", { name: /javascript/ })).toBeNull()
  fireEvent.click(screen.getByRole("option", { name: /typescript/ }))
  expect(confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "确定" }))
  expect(confirm).toHaveBeenCalledWith("ts")
})
it("cancels a changed selection without applying it", () => {
  const close = vi.fn(), confirm = vi.fn()
  render(<CodeLanguageDialog value="text" onClose={close} onConfirm={confirm} />)
  fireEvent.click(screen.getByRole("option", { name: /javascript/ }))
  fireEvent.click(screen.getByRole("button", { name: "取消" }))
  expect(close).toHaveBeenCalledOnce()
  expect(confirm).not.toHaveBeenCalled()
})
it("normalizes the old step value to a single steps option", () => {
  const confirm = vi.fn()
  render(<CodeLanguageDialog value="step" onClose={vi.fn()} onConfirm={confirm} />)
  expect(screen.getByRole("option", { name: /steps/ }).getAttribute("aria-selected")).toBe("true")
  expect(screen.queryByRole("option", { name: "step" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "确定" }))
  expect(confirm).toHaveBeenCalledWith("steps")
})
