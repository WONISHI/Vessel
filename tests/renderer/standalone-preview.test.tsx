import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import StandalonePreview from "@/components/transit/standalone-preview"
vi.mock("@/components/transit/file-preview", () => ({ FilePreview: ({ item }: any) => <div data-testid="preview">{item.content}</div> }))
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }))
afterEach(cleanup)
it("shows file tabs and switches previews while relying on native window controls", async () => {
  const first = { id: "/notes/中文.pdf", kind: "file" as const, content: "/notes/中文.pdf", root: "/notes", title: "中文.pdf" }
  const second = { ...first, id: "/notes/其他.md", content: "/notes/其他.md", title: "其他.md" }
  let update: any
  const unsubscribe = vi.fn()
  window.electronAPI = { ...window.electronAPI, onFilePreviewUpdated: vi.fn((callback) => { update = callback; return unsubscribe }), getFilePreview: vi.fn().mockResolvedValue(first), getFilePreviewTabs: vi.fn().mockResolvedValue([first, second]) }
  render(<StandalonePreview />)
  expect((await screen.findByTestId("preview")).textContent).toBe(first.content)
  expect(screen.getAllByRole("tab")).toHaveLength(2)
  fireEvent.click(screen.getByRole("tab", { name: "其他.md" }))
  expect(screen.getByTestId("preview").textContent).toBe(second.content)
  expect(screen.getByRole("tab", { name: "其他.md" }).getAttribute("aria-selected")).toBe("true")
  fireEvent.click(screen.getByLabelText("上一个文件"))
  expect(screen.getByTestId("preview").textContent).toBe(first.content)
  expect(screen.getByRole("tab", { name: "其他.md" }).textContent).toBe("")
  expect(screen.getByLabelText("预览文件标签").classList.contains("transit-bar")).toBe(true)
  const third = { ...first, id: "/notes/new.png", content: "/notes/new.png", title: "new.png" }
  act(() => update({ items: [first, second, third], selected: third.id }))
  expect(screen.getAllByRole("tab")).toHaveLength(3)
  expect(screen.getByTestId("preview").textContent).toBe(third.content)
  expect(screen.queryByLabelText("最大化或还原")).toBeNull()
})
