import { expect, it } from "vitest"
import { mindmapActionState } from "@/components/core/canvas/variants/mindmap/action-state"
it("requires a single selection for node commands and respects root, sibling and fold limits", () => {
  const root: any = { id: "root", children: [] }
  const first: any = { id: "first", parent: root }
  const branch: any = { id: "branch", parent: root, expanded: false, children: [{ id: "nested" }] }
  root.children = [first, branch]
  const empty = mindmapActionState(root, undefined, 0, false)
  expect(empty.child).toBeUndefined()
  expect(empty.unfocus).toBe(false)
  expect(empty["expand-all"]).toBe(true)
  const center = mindmapActionState(root, root, 1, false)
  expect(center.child).toBe(true)
  expect(center.delete).toBe(false)
  expect(center.sibling).toBe(false)
  const leaf = mindmapActionState(root, first, 1, false)
  expect(leaf.up).toBe(false)
  expect(leaf.down).toBe(true)
  expect(leaf.expand).toBe(false)
  expect(leaf["delete-children"]).toBe(false)
  const folded = mindmapActionState(root, branch, 1, true)
  expect(folded.expand).toBe(true)
  expect(folded.collapse).toBe(false)
  expect(folded.down).toBe(false)
  expect(folded.unfocus).toBe(true)
  expect(mindmapActionState(root, branch, 2, false).edit).toBeUndefined()
})
