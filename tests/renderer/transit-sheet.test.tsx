import { useToolboxImageImport } from "@/components/image-toolbox/import-state"
import { cleanup, renderHook, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { TransitStatus } from "@/components/transit/panel/components/transit-status"
import { TransitPanel } from "@/components/transit/panel/components/transit-panel"
const state = vi.hoisted(() => ({ push: vi.fn(), select: vi.fn(), selected: "one", items: [{ id: "one", kind: "text", title: "片段一", content: "示例文本" }, { id: "two", kind: "text", title: "片段二", content: "第二段" }] }))
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock("@/components/transit/state", () => ({ useTransit: () => ({ items: state.items, selected: state.selected }), selectTransit: state.select }))
vi.mock("@/components/transit/text-preview", () => ({ TransitTextPreview: ({ content }: { content: string }) => <pre>{content}</pre> }))
vi.mock("@/components/transit/file-preview", () => ({ FilePreview: ({ imageDetailsHidden, onImageDetailsHiddenChange }: { imageDetailsHidden: boolean; onImageDetailsHiddenChange: (hidden: boolean) => void }) => <button onClick={() => onImageDetailsHiddenChange(!imageDetailsHidden)}>{imageDetailsHidden ? "显示图片详情" : "隐藏图片详情"}</button> }))
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
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
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
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
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

it('aligns the preview with the window top and supports its toolbar actions', async () => {
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const openTransitWindow = vi.fn(async () => {})
  vi.stubGlobal('electronAPI', { openTransitWindow })
  render(<TransitPanel />)
  const sheet = screen.getByRole('dialog')
  expect(sheet.style.top).toBe('0px')
  expect(sheet.style.height).toBe('100dvh')
  fireEvent.click(screen.getByRole('button', { name: '展开' }))
  expect(screen.getByRole('button', { name: '还原' })).toBeTruthy()
  expect(screen.queryByLabelText('隐藏活动栏')).toBeNull()
  expect(screen.queryByLabelText('显示活动栏')).toBeNull()
  fireEvent.click(screen.getByLabelText('隐藏底部状态栏'))
  expect(screen.queryByLabelText('底部状态栏')).toBeNull()
  fireEvent.click(screen.getByLabelText('显示底部状态栏'))
  expect(sheet.style.left).toBe('52px')
  expect(screen.getByLabelText('底部状态栏')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '还原' }))
  fireEvent.click(screen.getByRole('button', { name: '独立窗口' }))
  await waitFor(() => expect(openTransitWindow).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: '中转站停靠方式' }))
  fireEvent.click(await screen.findByRole('button', { name: '悬浮' }))
  expect(document.querySelector('.transit-sheet.rounded-xl')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '关闭中转站' }))
  expect(state.select).toHaveBeenCalledWith(null)
})


it("keeps image details hidden across every dock and fullscreen transition", async () => {
  const original = state.items
  state.items = [{ id: "one", kind: "file", title: "photo.png", content: "/photo.png", root: "/vault" }] as unknown as typeof state.items
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  try {
    render(<TransitPanel />)
    const dock = screen.getByRole("button", { name: "中转站停靠方式" })
    expect(dock.parentElement?.className).toContain("ml-auto")
    fireEvent.click(await screen.findByRole("button", { name: "隐藏图片详情" }))
    for (const label of ["左侧", "底部", "悬浮", "右侧"]) {
      fireEvent.click(screen.getByRole("button", { name: "中转站停靠方式" }))
      fireEvent.click(await screen.findByRole("button", { name: label }))
      expect(await screen.findByRole("button", { name: "显示图片详情" })).toBeTruthy()
    }
    fireEvent.click(screen.getByRole("button", { name: "展开" }))
    expect(await screen.findByRole("button", { name: "显示图片详情" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "还原" }))
    expect(await screen.findByRole("button", { name: "显示图片详情" })).toBeTruthy()
  } finally { state.items = original }
})
