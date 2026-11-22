import { act, cleanup, renderHook } from "@testing-library/react"
import { useRef, useState } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { newTab, type Tab } from "@/pages/browser/components/index-shared"
import { useBrowserActions } from "@/pages/browser/components/browser-page/hooks/use-browser-actions"
import type { BrowserState } from "@/pages/browser/components/browser-page/hooks/use-browser-state"

vi.mock("@/pages/browser/components/browser-page/hooks/use-browser-find", () => ({ useBrowserFind: () => vi.fn() }))
beforeEach(() => vi.stubGlobal("electronAPI", { onBrowserNewTab: () => () => {}, setBrowserDevtools: vi.fn(async () => {}) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const tab = (id: string, patch: Partial<Tab> = {}) => ({ ...newTab(), id, title: id, ...patch })
function model(initial: Tab[], activeId: string) {
  return renderHook(() => {
    const [tabs, setTabs] = useState(initial)
    const [active, setActive] = useState(activeId)
    const [input, setInput] = useState<string | null>("draft")
    const views = useRef(new Map())
    const devtoolsHost = useRef(null)
    const state = { tabs, setTabs, tab: tabs.find((item) => item.id === active) || tabs[0], views, devtoolsHost, setActive, setInput } as unknown as BrowserState
    return { ...useBrowserActions(state, false), tabs, active, input }
  })
}
it("closes a background group together and leaves the active page and input intact", () => {
  const { result } = model([tab("a"), tab("active"), tab("b")], "active")
  act(() => result.current.closeTabs(["a", "b"]))
  expect(result.current.tabs.map((item) => item.id)).toEqual(["active"])
  expect(result.current.active).toBe("active")
  expect(result.current.input).toBe("draft")
})
it("selects a surviving opener when the active group closes", () => {
  const { result } = model([tab("opener"), tab("a"), tab("b", { openerId: "opener" }), tab("right")], "b")
  act(() => result.current.closeTabs(["a", "b"]))
  expect(result.current.tabs.map((item) => item.id)).toEqual(["opener", "right"])
  expect(result.current.active).toBe("opener")
  expect(result.current.input).toBeNull()
})
it("keeps one new tab if the closed group contains every tab", () => {
  const { result } = model([tab("a"), tab("b")], "b")
  act(() => result.current.closeTabs(["a", "b"]))
  expect(result.current.tabs).toHaveLength(1)
  expect(result.current.tabs[0]).toMatchObject({ title: "新标签页", url: "" })
  expect(result.current.active).toBe(result.current.tabs[0].id)
})
it("retains the whole group and unrelated pinned pages when closing other tabs", () => {
  const { result } = model([tab("a"), tab("other"), tab("b"), tab("pinned", { pinned: true })], "other")
  act(() => result.current.closeOtherTabs(["b", "a"]))
  expect(result.current.tabs.map((item) => item.id)).toEqual(["a", "b", "pinned"])
  expect(result.current.active).toBe("b")
})
it("pins and unpins every member together without changing other pages", () => {
  const { result } = model([tab("a", { pinned: true }), tab("other"), tab("b")], "a")
  act(() => result.current.togglePinTab(["a", "b"]))
  expect(result.current.tabs.map((item) => !!item.pinned)).toEqual([true, false, true])
  act(() => result.current.togglePinTab(["a", "b"]))
  expect(result.current.tabs.map((item) => !!item.pinned)).toEqual([false, false, false])
})
