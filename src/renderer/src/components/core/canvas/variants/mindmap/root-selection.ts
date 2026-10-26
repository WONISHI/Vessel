import type { MindElixirInstance } from "mind-elixir"

/** Native dragging selects only non-root topics; explicitly select a clicked center topic. */
export function bindRootSelection(editor: MindElixirInstance) {
  const container = editor.container
  let moved = false
  let start: { x: number; y: number } | null = null
  const rootTopic = (target: EventTarget | null) => {
    const topic = target instanceof Element ? target.closest("me-tpc") : null
    return topic?.parentElement?.tagName === "ME-ROOT" && container.contains(topic) ? topic as Parameters<MindElixirInstance["selectNode"]>[0] : null
  }
  const down = (event: PointerEvent) => {
    moved = false
    start = event.button === 0 && !event.ctrlKey && !event.metaKey && !editor.spacePressed && rootTopic(event.target) ? { x: event.clientX, y: event.clientY } : null
  }
  const move = (event: PointerEvent) => {
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) moved = true
  }
  const click = (event: MouseEvent) => {
    const topic = rootTopic(event.target)
    if (topic && event.button === 0 && !event.ctrlKey && !event.metaKey && !editor.spacePressed && !moved && !topic.isContentEditable) editor.selectNode(topic)
    start = null
    moved = false
  }
  const cancel = () => { start = null; moved = true }
  container.addEventListener("pointerdown", down, true)
  document.addEventListener("pointermove", move)
  container.addEventListener("click", click)
  document.addEventListener("pointercancel", cancel)
  return () => {
    container.removeEventListener("pointerdown", down, true)
    document.removeEventListener("pointermove", move)
    container.removeEventListener("click", click)
    document.removeEventListener("pointercancel", cancel)
  }
}
