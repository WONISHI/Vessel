import { act, renderHook } from "@testing-library/react"
import { expect, it } from "vitest"
import { useActivatedTabs } from "@/pages/browser/use-activated-tabs"
it("loads the active restored guest first and keeps visited guests when switching back", () => {
  const tabs = [{ id: "a" }, { id: "b" }, { id: "c" }]
  const view = renderHook(({ active, tabs }) => useActivatedTabs(active, tabs), { initialProps: { active: "b", tabs } })
  expect([...view.result.current]).toEqual(["b"])
  act(() => view.rerender({ active: "a", tabs }))
  expect([...view.result.current].sort()).toEqual(["a", "b"])
  act(() => view.rerender({ active: "b", tabs }))
  expect(view.result.current.has("a")).toBe(true)
  expect(view.result.current.has("c")).toBe(false)
  act(() => view.rerender({ active: "b", tabs: tabs.slice(1) }))
  expect(view.result.current.has("a")).toBe(false)
})
