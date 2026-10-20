import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { BaseBreadcrumb } from "@/components/core/canvas/variants/base/components/base-breadcrumb"
import { ObsidianPropertyValue } from "@/components/obsidian-property-value"
import { StatusBar } from "@/components/ui/status-bar"
import { parseCalendarDate } from "@vessel/utils"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("reveals root, folder and Base file through the same event as Markdown breadcrumbs", () => {
  const reveal = vi.fn()
  window.addEventListener("vessel:reveal-file", reveal)
  try {
    render(
      <BaseBreadcrumb
        root="/vault"
        path="/vault/工作/list.base"
      />
    )
    expect(document.querySelector("[data-title]")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "vault" }))
    fireEvent.click(screen.getByRole("button", { name: "工作" }))
    fireEvent.click(screen.getByRole("button", { name: "list.base" }))
    expect(reveal.mock.calls.map(([event]) => event.detail)).toEqual(["/vault", "/vault/工作", "/vault/工作/list.base"])
  } finally {
    window.removeEventListener("vessel:reveal-file", reveal)
  }
})

it("browses a property date without updating its displayed value or saving the file", () => {
  const saveContent = vi.fn()
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { saveContent } })
  render(
    <ObsidianPropertyValue
      text="2026-04-11"
      root="/vault"
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "查看日期 2026-04-11" }))
  expect(screen.getByRole("button", { name: "2026-04-11" }).getAttribute("aria-pressed")).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "2026-04-12" }))
  expect(screen.getByRole("button", { name: "2026-04-12" }).getAttribute("aria-pressed")).toBe("true")
  expect(screen.getByRole("button", { name: "查看日期 2026-04-11" }).textContent).toBe("2026-04-11")
  fireEvent.click(screen.getByRole("button", { name: "下个月" }))
  expect(screen.getByText("2026年 5月")).toBeTruthy()
  expect(saveContent).not.toHaveBeenCalled()
})

it("opens the same calendar from the status clock and rejects invalid property dates", () => {
  expect(parseCalendarDate("2026-02-30")).toBeNull()
  expect(parseCalendarDate("2026-04-11T09:32:00Z")?.getDate()).toBe(11)
  render(<StatusBar />)
  fireEvent.click(screen.getByRole("button", { name: "查看日历" }))
  expect(screen.getByText("仅供查看，不修改原始日期")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "明天" }))
  expect(screen.getByLabelText("只读日历")).toBeTruthy()
})
