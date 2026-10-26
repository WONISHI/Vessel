import { expect, it, vi } from "vitest"
import type { MindElixirInstance } from "mind-elixir"
import { bindRootSelection } from "@/components/core/canvas/variants/mindmap/root-selection"

it("selects the center topic and its text, preserving canvas dragging and space panning", () => {
  const container = document.createElement("div")
  container.innerHTML = '<me-root><me-tpc><span>中心主题</span></me-tpc></me-root><me-main><me-tpc>分支</me-tpc></me-main>'
  document.body.append(container)
  const selectNode = vi.fn()
  const editor = { container, selectNode, spacePressed: false } as unknown as MindElixirInstance
  const dispose = bindRootSelection(editor)
  const topic = container.querySelector("me-root me-tpc")!
  const text = topic.querySelector("span")!
  try {
    text.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
    expect(selectNode).toHaveBeenCalledWith(topic)
    selectNode.mockClear()
    topic.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
    document.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 30, clientY: 30 }))
    topic.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
    expect(selectNode).not.toHaveBeenCalled()
    editor.spacePressed = true
    text.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
    expect(selectNode).not.toHaveBeenCalled()
    editor.spacePressed = false
    dispose()
    text.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
    expect(selectNode).not.toHaveBeenCalled()
  } finally { dispose(); container.remove() }
})
