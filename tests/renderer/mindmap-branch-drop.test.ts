import { afterEach, expect, it, vi } from "vitest"
import type { MindElixirInstance } from "mind-elixir"
import { bindBranchDrop } from "@/components/core/canvas/variants/mindmap/branch-drop"
afterEach(() => document.body.replaceChildren())
it("moves a lower sibling above another by dropping in the gap", () => {
  const root = document.createElement("div")
  document.body.append(root)
  const first = document.createElement("me-tpc") as any, second = document.createElement("me-tpc") as any
  const parent = { children: [] as any[] }
  first.nodeObj = { id: "first", parent }; second.nodeObj = { id: "second", parent }
  parent.children = [first.nodeObj, second.nodeObj]
  root.append(first, second)
  first.getBoundingClientRect = () => ({ left: 100, right: 180, top: 100, height: 24 })
  const moveNodeBefore = vi.fn(async () => {}), moveNodeAfter = vi.fn(async () => {})
  const dispose = bindBranchDrop({ container: root, findEle: () => first, moveNodeBefore, moveNodeAfter } as unknown as MindElixirInstance, vi.fn())
  const pointer = (name: string, x: number, y: number) => new MouseEvent(name, { bubbles: true, button: 0, clientX: x, clientY: y })
  second.dispatchEvent(pointer("pointerdown", 130, 300))
  document.dispatchEvent(pointer("pointermove", 130, 80))
  expect(first.getAttribute("data-vessel-branch-drop")).toBe("before")
  document.dispatchEvent(pointer("pointerup", 130, 80))
  expect(moveNodeBefore).toHaveBeenCalledWith([second], first)
  expect(moveNodeAfter).not.toHaveBeenCalled()
  expect(first.hasAttribute("data-vessel-branch-drop")).toBe(false)
  dispose()
})
