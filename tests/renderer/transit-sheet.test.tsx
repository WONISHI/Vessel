import { useToolboxImageImport } from "@/components/image-toolbox/import-state"
import { cleanup, renderHook, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { TransitStatus } from "@/components/transit/panel/components/transit-status"
import { TransitPanel } from "@/components/transit/panel/components/transit-panel"
const state = vi.hoisted(() => ({ push: vi.fn(), select: vi.fn(), selected: "one", items: [{ id: "one", kind: "text", title: "片段一", content: "示例文本" }, { id: "two", kind: "text", title: "片段二", content: "第二段" }] }))
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock("@/components/transit/state", () => ({ useTransit: () => ({ items: state.items, selected: state.selected }), selectTransit: state.select }))
vi.mock("@/components/transit/file-preview", () => ({ FilePreview: () => null }))
vi.mock("@/components/transit/panel/components/web-preview", () => ({ WebPreview: () => null }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); state.select.mockClear(); state.push.mockClear() })
it("copies clipboard text and opens the shared calendar without a bottom dock button", async () => {
  const writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  render(<TransitStatus item={{ id: "one", kind: "text", title: "片段", content: "示例文本" }} onRefresh={vi.fn()} />)
  expect(screen.getByText("4 字")).toBeTruthy()
  expect(document.querySelector("time")?.textContent).toMatch(/年\d{2}月\d{2}日/)
  expect(screen.getByText(/星期[日一二三四五六]/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "复制中转文本" }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("示例文本"))
  expect(screen.queryByRole("button", { name: "中转站停靠方式" })).toBeNull()
  expect(screen.getByRole("button", { name: "复制中转文本" }).textContent).toBe("复制")
  fireEvent.click(screen.getByRole("button", { name: "查看日历" }))
  expect(await screen.findByText("仅供查看，不修改原始日期")).toBeTruthy()
  expect(document.querySelector('[data-radix-popper-content-wrapper] > [role="dialog"]')?.className).toContain("z-[300]")
})
it("shows file metadata without fetching a second copy", () => {
  render(<TransitStatus item={{ id: "one", kind: "file", root: "/vault", title: "index.ts", content: "/vault/index.ts" }} file={{ kind: "text", content: "one\ntwo" }} onRefresh={vi.fn()} />)
  expect(screen.getByText("index.ts")).toBeTruthy()
  expect(screen.getByText("2 行")).toBeTruthy()
})
it("switches fragments from the icon strip and closes the sheet", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  render(<TransitPanel />)
  expect(screen.getAllByRole("tab")).toHaveLength(2)
  fireEvent.click(screen.getByRole("tab", { name: "片段二" }))
  expect(state.select).toHaveBeenCalledWith("two")
  fireEvent.click(screen.getByRole("button", { name: "关闭中转站" }))
  expect(state.select).toHaveBeenCalledWith(null)
})

it("shows four tabs per page and the remaining two when advancing past item four", () => {
  const original = state.items
  state.items = Array.from({ length: 6 }, (_, index) => ({ id: `item-${index}`, kind: "text", title: `片段${index + 1}`, content: `内容${index + 1}` }))
  state.selected = "item-3"
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  try {
    const view = render(<TransitPanel />)
    expect(screen.getAllByRole("tab")).toHaveLength(4)
    expect(screen.queryByRole("tab", { name: "片段5" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "下一个中转项" }))
    expect(state.select).toHaveBeenCalledWith("item-4")
    state.selected = "item-4"
    view.rerender(<TransitPanel />)
    expect(screen.getAllByRole("tab")).toHaveLength(2)
    expect(screen.getByRole("tab", { name: "片段5" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "片段6" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "上一个中转项" }))
    expect(state.select).toHaveBeenCalledWith("item-3")
  } finally { state.items = original; state.selected = "one" }
})
it("uses Markdown document statistics and exposes webpage search and refresh", () => {
  const view = render(<TransitStatus item={{ id: "md", kind: "file", title: "note.md", root: "/vault", content: "/vault/note.md" }} file={{ kind: "markdown", content: "Hello world\nnext" }} onRefresh={vi.fn()} />)
  expect(screen.getByText("3 词")).toBeTruthy()
  expect(screen.getByText("16 字")).toBeTruthy()
  view.unmount()
  const search = vi.fn(), refresh = vi.fn()
  render(<TransitStatus item={{ id: "url", kind: "url", title: "网页", content: "https://example.com" }} onSearch={search} onRefresh={refresh} />)
  fireEvent.click(screen.getByRole("button", { name: "搜索中转网页" }))
  fireEvent.click(screen.getByRole("button", { name: "刷新中转网页" }))
  expect(search).toHaveBeenCalledOnce()
  expect(refresh).toHaveBeenCalledOnce()
})
it("shows decoded image dimensions and byte size with an edit action", async () => {
  vi.stubGlobal("Image", class {
    naturalWidth = 640; naturalHeight = 480; onload: (() => void) | null = null
    set src(_value: string) { this.onload?.() }
  })
  render(<TransitStatus item={{ id: "image", kind: "file", root: "/vault", title: "image.png", content: "/vault/image.png" }} file={{ kind: "image", content: "data:image/png;base64,YWJj" }} onRefresh={vi.fn()} />)
  expect(await screen.findByText("640 × 480")).toBeTruthy()
  expect(screen.getByText("3 B")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "编辑中转图片" }))
  const imported = renderHook(() => useToolboxImageImport())
  expect(imported.result.current?.source).toBe("data:image/png;base64,YWJj")
  expect(state.push).toHaveBeenCalledWith("/image")
  expect(state.select).toHaveBeenCalledWith(null)
})
