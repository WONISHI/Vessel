import React from "react"
import { expect, it, vi, afterEach } from "vitest"
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react"
import TodoMain from "../../src/renderer/src/pages/todos/components/layout-main"
import { dateKey, fromKey, lunarLabel, monthDays, festivalLabel } from "../../src/renderer/src/pages/todos/calendar"
afterEach(cleanup)
it("builds Monday-first calendars and correct lunar days", () => {
  const days = monthDays(fromKey("2026-09-27"))
  expect(dateKey(days[0])).toBe("2026-08-31")
  expect(dateKey(days.at(-1)!)).toBe("2026-10-04")
  expect(lunarLabel(fromKey("2026-09-25"))).toBe("十五")
  expect(monthDays(fromKey("2024-02-01")).some((day) => dateKey(day) === "2024-02-29")).toBe(true)
})
it("selects calendar dates and submits a todo with Enter/form submit", async () => {
  const onSelect = vi.fn(),
    onAdd = vi.fn().mockResolvedValue(true)
  render(
    <TodoMain
      todos={[]}
      selected="2026-09-27"
      month={fromKey("2026-09-27")}
      onSelect={onSelect}
      onMonth={vi.fn()}
      onAdd={onAdd}
      onComplete={vi.fn()}
      onDelete={vi.fn()}
      busy={false}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: /2026-09-28/ }))
  expect(onSelect).toHaveBeenCalledWith("2026-09-28")
  const input = screen.getByRole("textbox", { name: "待办内容" })
  fireEvent.change(input, { target: { value: "整理资料" } })
  fireEvent.submit(input.closest("form")!)
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith("整理资料"))
  await waitFor(() => expect((input as HTMLInputElement).value).toBe(""))
})

it("shows festival names without treating them as leave schedules", () => {
 expect(festivalLabel(fromKey("2026-09-25"))).toBe("中秋节")
 expect(festivalLabel(fromKey("2026-10-01"))).toBe("国庆节")
 expect(festivalLabel(fromKey("2026-02-17"))).toBe("春节")
})
