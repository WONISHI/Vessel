import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { StoragePage } from "@/pages/debug/storage/components/storage-page"

vi.mock("@/pages/debug/components/page-back-button", () => ({ PageBackButton: () => null }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("shows database groups and reads/searches the selected qualified table", async () => {
  const listStorageTables = vi.fn().mockResolvedValue(["vessel.db", "todos.sqlite"].map((name) => ({
    name: `${name}/todos`, rowCount: 1, columns: [{ name: "title", type: "TEXT", primaryKey: 0 }]
  })))
  const readStorageTable = vi.fn().mockImplementation(async (name: string) => ({ page: 1, total: 1, rows: [{ title: `记录来自 ${name}` }] }))
  vi.stubGlobal("electronAPI", { listStorageTables, readStorageTable })
  render(<StoragePage />)
  expect(await screen.findByText("2 个数据库 · 2 张表")).toBeTruthy()
  expect(screen.getByText("vessel.db")).toBeTruthy()
  expect(screen.getByText("todos.sqlite")).toBeTruthy()
  await screen.findByText("记录来自 vessel.db/todos")
  const buttons = screen.getAllByRole("button", { name: /日历待办/ })
  fireEvent.click(buttons[1])
  expect(await screen.findByText("记录来自 todos.sqlite/todos")).toBeTruthy()
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "测试" } })
  await waitFor(() => expect(readStorageTable).toHaveBeenLastCalledWith("todos.sqlite/todos", 1, "测试", 50))
  fireEvent.click(screen.getByRole("button", { name: "刷新" }))
  await waitFor(() => expect(listStorageTables).toHaveBeenCalledTimes(2))
  expect(screen.getByRole("button", { name: /日历待办/, pressed: true })).toBe(buttons[1])
})
