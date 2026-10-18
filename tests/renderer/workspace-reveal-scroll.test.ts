import { expect, it } from "vitest"
import { treeRevealScrollTop } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/reveal-scroll"

it("preserves scrolling for visible rows including viewport boundaries", () => {
  expect(treeRevealScrollTop(10, 320, 320)).toBe(320)
  expect(treeRevealScrollTop(15, 320, 320)).toBe(320)
  expect(treeRevealScrollTop(19, 320, 320)).toBe(320)
})
it("reveals offscreen and partially visible rows using the nearest edge", () => {
  expect(treeRevealScrollTop(9, 320, 320)).toBe(288)
  expect(treeRevealScrollTop(20, 320, 320)).toBe(352)
  expect(treeRevealScrollTop(10, 330, 320)).toBe(320)
  expect(treeRevealScrollTop(20, 330, 320)).toBe(352)
})
