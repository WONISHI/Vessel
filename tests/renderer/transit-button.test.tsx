import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { TransitButton } from "@/components/transit/button"

vi.mock("@/components/transit/state", () => ({ useTransit: () => ({ items: [], selected: null }), addTransit: vi.fn(), addTransitFile: vi.fn(), deleteTransit: vi.fn(), selectTransit: vi.fn() }))
afterEach(cleanup)

it("opens the import popup by click, not by hovering or moving through the sidebar", async () => {
  render(<TransitButton />)
  const trigger = screen.getByRole("button", { name: "中转站" })
  fireEvent.mouseEnter(trigger)
  expect(screen.queryByText("导入文件")).toBeNull()
  fireEvent.mouseLeave(trigger)
  expect(screen.queryByText("导入文件")).toBeNull()
  fireEvent.click(trigger)
  expect(await screen.findByText("导入文件")).toBeTruthy()
  fireEvent.mouseLeave(trigger)
  expect(screen.getByText("导入文件")).toBeTruthy()
  fireEvent.click(trigger)
  expect(screen.queryByText("导入文件")).toBeNull()
})
