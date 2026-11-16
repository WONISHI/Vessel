import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ClipboardPanel } from "@/features/clipboard/components/clipboard-panel"
import type { ClipboardHistoryAPI, ClipboardState } from "@vessel/type"

let state: ClipboardState
let changed: () => void
const api = {
  state: vi.fn(async () => state), copy: vi.fn(async () => {}), pin: vi.fn(async () => {}), remove: vi.fn(async () => {}),
  clear: vi.fn(async () => {}), pause: vi.fn(async () => {}), keepOpen: vi.fn(async () => {}), close: vi.fn(async () => {}),
  onChange: vi.fn((callback: () => void) => { changed = callback; return () => {} }), onShow: vi.fn(() => () => {})
} satisfies ClipboardHistoryAPI
beforeEach(() => {
  vi.useFakeTimers()
  state = { entries: [{ id: 1, kind: "text", preview: "first copied text", createdAt: Date.now(), pinned: false, size: 17, characters: 17, files: [] }, { id: 2, kind: "link", preview: "https://example.com", createdAt: Date.now(), pinned: false, size: 19, characters: 19, files: [] }], total: 2, paused: false, keepOpen: false, shortcut: "Control+V", shortcutRegistered: true }
  window.clipboardAPI = api
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.useRealTimers() })
const ready = async () => { await act(async () => { vi.advanceTimersByTime(150) }) }

it("selects with arrows, copies with Enter, ignores IME Enter and closes with Escape", async () => {
  render(<ClipboardPanel />)
  await ready()
  const search = screen.getByRole("searchbox", { name: "搜索剪贴板" })
  fireEvent.keyDown(search, { key: "ArrowRight" })
  await act(async () => { fireEvent.keyDown(search, { key: "Enter" }) })
  expect(api.copy).toHaveBeenCalledWith(2, false)
  fireEvent.keyDown(search, { key: "Enter", isComposing: true })
  expect(api.copy).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(search, { key: "Escape" })
  expect(api.close).toHaveBeenCalledTimes(1)
})

it("queries the backend and keeps text editing keys inside the search field", async () => {
  render(<ClipboardPanel />)
  await ready()
  const search = screen.getByRole("searchbox", { name: "搜索剪贴板" })
  fireEvent.change(search, { target: { value: "deep keyword" } })
  await ready()
  expect(api.state).toHaveBeenLastCalledWith({ query: "deep keyword", kind: undefined, pinnedOnly: false })
  fireEvent.keyDown(search, { key: "ArrowRight" })
  await act(async () => { fireEvent.keyDown(search, { key: "Enter" }) })
  expect(api.copy).toHaveBeenLastCalledWith(1, false)
  fireEvent.click(screen.getByRole("button", { name: "图片" }))
  await ready()
  expect(api.state).toHaveBeenLastCalledWith({ query: "deep keyword", kind: "image", pinnedOnly: false })
})

it("refreshes history and provides record pinning, removal and pause controls", async () => {
  render(<ClipboardPanel />)
  await ready()
  await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "固定记录" })[0]) })
  expect(api.pin).toHaveBeenCalledWith(1)
  await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "删除记录" })[0]) })
  expect(api.remove).toHaveBeenCalledWith(1)
  state = { ...state, entries: [], total: 0 }
  act(() => changed())
  await ready()
  expect(screen.getByText("复制一点内容，留在这里")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "更多操作" }))
  await act(async () => { fireEvent.click(screen.getByRole("menuitem", { name: "暂停记录复制内容" })) })
  expect(api.pause).toHaveBeenCalledWith(true)
})
