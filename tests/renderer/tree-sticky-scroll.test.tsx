import { act, cleanup, fireEvent, render, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { VirtualTree } from "@/components/ui/tree"
import { stickyTreeEntries, stickyTreeModel } from "@/components/ui/tree/components/sticky-tree-model"
import { useResourceStickyScroll } from "@/features/directory-tree/use-resource-sticky-scroll"
import { treeRevealScrollTop } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/reveal-scroll"

const rows = [
  { id: "a", depth: 0, expanded: true, item: "a" },
  { id: "b", depth: 1, expanded: true, item: "b" },
  { id: "file1", depth: 2, item: "file1" },
  { id: "file2", depth: 2, item: "file2" },
  { id: "c", depth: 1, expanded: false, item: "c" },
  { id: "d", depth: 0, expanded: true, item: "d" },
  { id: "file3", depth: 1, item: "file3" },
  { id: "empty", depth: 0, expanded: true, item: "empty" }
]
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn() })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("tracks subtree ranges and only pins folders that have scrolled past their slots", () => {
  const model = stickyTreeModel(rows)
  expect(model.parents).toEqual([-1, 0, 1, 1, 0, -1, 5, -1])
  expect(model.ends).toEqual([4, 3, 2, 3, 4, 6, 6, 7])
  const at = (scroll: number) => stickyTreeEntries(rows, model, scroll, 200, 20)
  expect(at(0)).toEqual([])
  expect(at(1)).toEqual([{ index: 0, top: 0 }, { index: 1, top: 20 }])
  expect(at(41)).toEqual([{ index: 0, top: 0 }, { index: 1, top: 19 }])
  expect(at(60)).toEqual([{ index: 0, top: 0 }])
  expect(at(81)).toEqual([{ index: 0, top: -1 }])
  expect(at(100)).toEqual([])
  expect(at(101)).toEqual([{ index: 5, top: 0 }])
  expect(at(141)).toEqual([])
})

it("respects row gaps, viewport height and collapse changes", () => {
  const model = stickyTreeModel(rows)
  expect(stickyTreeEntries(rows, model, 1, 200, 20, 4)).toEqual([{ index: 0, top: 0 }, { index: 1, top: 24 }])
  expect(stickyTreeEntries(rows, model, 1, 60, 20)).toHaveLength(1)
  const collapsed = [ { ...rows[0], expanded: false }, ...rows.slice(5)]
  expect(stickyTreeEntries(collapsed, stickyTreeModel(collapsed), 1, 200, 20)).toEqual([])
})

it("renders offscreen ancestors without changing list height and reuses row interactions", () => {
  const viewport = document.createElement("div")
  Object.defineProperty(viewport, "clientHeight", { value: 200 })
  const manyRows = [rows[0], rows[1], ...Array.from({ length: 1000 }, (_, i) => ({ id: `file-${i}`, depth: 2, item: `file-${i}` })), rows[5], rows[6]]
  const select = vi.fn(), context = vi.fn()
  const props = { rows: manyRows, viewport, rowHeight: 20, stickyScroll: true, renderRow: ({ item }: { item: string }) => <button onClick={() => select(item)} onContextMenu={() => context(item)}>{item}</button> }
  const view = render(<VirtualTree {...props} />)
  const tree = view.container.querySelector<HTMLElement>('[role="tree"]')!
  const originalHeight = tree.style.height
  tree.getBoundingClientRect = () => ({ top: -viewport.scrollTop }) as DOMRect
  viewport.scrollTop = 8000
  fireEvent.scroll(viewport)
  const sticky = view.container.querySelector('[data-tree-sticky-row="b"]')!
  expect(sticky).toBeTruthy()
  expect(view.container.querySelectorAll('[role="treeitem"]').length).toBeLessThan(160)
  fireEvent.click(sticky.querySelector("button")!)
  fireEvent.contextMenu(sticky.querySelector("button")!)
  expect(select).toHaveBeenCalledWith("b")
  expect(context).toHaveBeenCalledWith("b")
  expect(tree.style.height).toBe(originalHeight)
  view.rerender(<VirtualTree {...props} stickyScroll={false} />)
  expect(view.container.querySelector('[data-tree-sticky-anchor]')).toBeNull()
  expect(tree.style.height).toBe(originalHeight)
})

it("applies saved changes only to project resources", async () => {
  let enabled = true
  const getSettings = vi.fn(async () => ({ resourceTreeStickyScroll: enabled }))
  vi.stubGlobal("electronAPI", { getSettings })
  const hook = renderHook(({ resources }) => useResourceStickyScroll(resources), { initialProps: { resources: false } })
  expect(hook.result.current).toBe(false)
  expect(getSettings).not.toHaveBeenCalled()
  hook.rerender({ resources: true })
  await waitFor(() => expect(getSettings).toHaveBeenCalledOnce())
  expect(hook.result.current).toBe(true)
  enabled = false
  act(() => window.dispatchEvent(new Event("vessel:settings-saved")))
  await waitFor(() => expect(hook.result.current).toBe(false))
  enabled = true
  act(() => window.dispatchEvent(new Event("vessel:settings-saved")))
  await waitFor(() => expect(hook.result.current).toBe(true))
})

it("reveals selected files below the pinned ancestors", () => {
  expect(treeRevealScrollTop(10, 190, 200, 20, 0, 40)).toBe(160)
  expect(treeRevealScrollTop(15, 190, 200, 20, 0, 40)).toBe(190)
})
