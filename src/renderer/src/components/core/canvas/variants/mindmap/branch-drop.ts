import type { MindElixirInstance } from "mind-elixir"
type Topic = Parameters<MindElixirInstance["moveNodeBefore"]>[1]

/** Extend native sibling sorting into the whitespace between same-level topics. */
export function bindBranchDrop(editor: MindElixirInstance, onError: (error: unknown) => void) {
  const root = editor.container
  let drag: { node: Topic; parent: Topic["nodeObj"]["parent"]; x: number; y: number; id: number } | null = null
  let target: { node: Topic; before: boolean } | null = null
  const clearTarget = () => { target?.node.removeAttribute("data-vessel-branch-drop"); target = null }
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || editor.spacePressed) return
    const node = (event.target as Element)?.closest("me-tpc") as Topic | null
    if (!node?.nodeObj?.parent || node.isContentEditable) return
    drag = { node, parent: node.nodeObj.parent, x: event.clientX, y: event.clientY, id: event.pointerId }
  }
  const move = (event: PointerEvent) => {
    clearTarget()
    if (!drag || drag.id !== event.pointerId || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return
    // Keep native reparenting and dropping inside a topic unchanged.
    const hit = document.elementFromPoint?.(event.clientX, event.clientY)?.closest("me-tpc")
    if (hit) return
    let distance = Infinity
    for (const sibling of drag.parent?.children ?? []) {
      if (sibling.id === drag.node.nodeObj.id) continue
      const node = editor.findEle(sibling.id)
      const rect = node?.getBoundingClientRect()
      if (!rect || event.clientX < rect.left - 80 || event.clientX > rect.right + 80) continue
      const delta = Math.abs(event.clientY - (rect.top + rect.height / 2))
      if (delta < distance && delta < 140) { distance = delta; target = { node, before: event.clientY < rect.top + rect.height / 2 } }
    }
    if (target) target.node.setAttribute("data-vessel-branch-drop", target.before ? "before" : "after")
  }
  const up = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return
    const current = drag, drop = target
    drag = null
    clearTarget()
    if (!drop || current.node.nodeObj.parent !== current.parent || drop.node.nodeObj.parent !== current.parent) return
    const children = current.parent?.children ?? []
    const from = children.indexOf(current.node.nodeObj), to = children.indexOf(drop.node.nodeObj)
    if (from < 0 || to < 0 || (drop.before ? from === to - 1 : from === to + 1)) return
    void (drop.before ? editor.moveNodeBefore([current.node], drop.node) : editor.moveNodeAfter([current.node], drop.node)).catch(onError)
  }
  const cancel = () => { drag = null; clearTarget() }
  root.addEventListener("pointerdown", down, true)
  document.addEventListener("pointermove", move)
  document.addEventListener("pointerup", up)
  document.addEventListener("pointercancel", cancel)
  return () => {
    cancel()
    root.removeEventListener("pointerdown", down, true)
    document.removeEventListener("pointermove", move)
    document.removeEventListener("pointerup", up)
    document.removeEventListener("pointercancel", cancel)
  }
}
