import { expect, it } from "vitest"
import { pinnedTabsFirst } from "@/pages/browser/tab-order"
it("moves pinned tabs to the front without changing tab identity or regular tab order", () => {
  const first = { id: "one" }, pinned = { id: "two", pinned: true }, third = { id: "three" }
  const original = [first, pinned, third]
  expect(pinnedTabsFirst(original)).toEqual([pinned, first, third])
  expect(original).toEqual([first, pinned, third])
  expect(pinnedTabsFirst(original)[0]).toBe(pinned)
})
it("keeps pinned groups together after drag/reload and supports unpinning", () => {
  const tabs = [{ id: "regular" }, { id: "p1", pinned: true }, { id: "p2", pinned: true }]
  const ordered = pinnedTabsFirst(tabs)
  expect(ordered.map((tab) => tab.id)).toEqual(["p1", "p2", "regular"])
  expect(pinnedTabsFirst(ordered)).toBe(ordered)
  expect(pinnedTabsFirst(ordered.map((tab) => tab.id === "p1" ? { ...tab, pinned: false } : tab)).map((tab) => tab.id)).toEqual(["p2", "p1", "regular"])
})
