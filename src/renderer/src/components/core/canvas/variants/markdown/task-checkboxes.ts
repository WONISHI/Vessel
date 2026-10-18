import { Checkbox } from "@/components/ui/checkbox"
import { createElement, Fragment } from "react"
import { createRoot } from "react-dom/client"

/** Renders shadcn controls outside editable content, retaining Vditor's native task state. */
export function bindTaskCheckboxes(root: HTMLElement, readOnly = false) {
  const overlay = document.createElement("div")
  overlay.className = "vessel-task-checkbox-layer"
  document.body.append(overlay)
  const reactRoot = createRoot(overlay)
  const tracked = new Map<HTMLInputElement, { hidden: string | null; tabindex: string | null; id: number }>()
  let sequence = 0
  let frame = 0
  let disposed = false

  /** Updates checked state and clips controls to the editor's scrolling viewport. */
  const paint = () => {
    frame = 0
    if (disposed) return
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('.vditor-reset li input[type="checkbox"]'))
    const live = new Set(inputs)
    for (const [input, original] of tracked) {
      if (live.has(input)) continue
      restore(input, original)
      tracked.delete(input)
    }
    const controls = inputs.flatMap((input) => {
      if (!tracked.has(input)) {
        tracked.set(input, { hidden: input.getAttribute("aria-hidden"), tabindex: input.getAttribute("tabindex"), id: sequence++ })
        input.classList.add("vessel-native-task-checkbox")
        input.setAttribute("aria-hidden", "true")
        input.tabIndex = -1
      }
      const rect = input.getBoundingClientRect()
      const viewport = input.closest<HTMLElement>(".vditor-ir, .vditor-wysiwyg") || root
      const bounds = viewport.getBoundingClientRect()
      if (!rect.width || !rect.height || rect.top < Math.max(0, bounds.top) || rect.bottom > Math.min(innerHeight, bounds.bottom) || rect.left < bounds.left || rect.right > bounds.right) return []
      const label = input.closest("li")?.textContent?.replace(/^[\s\u200b]+/, "").trim().slice(0, 160) || "任务完成状态"
      return [createElement(Checkbox, {
        key: tracked.get(input)!.id,
        className: "vessel-task-checkbox",
        checked: input.checked,
        disabled: readOnly || input.disabled,
        "aria-label": label,
        style: { position: "fixed", left: rect.left, top: rect.top, width: rect.width, height: rect.height, pointerEvents: "auto" },
        /** Keeps clicking a checkbox from moving the editor caret. */
        onMouseDown: (event) => event.preventDefault(),
        /** Delegates task changes to the native editor control. */
        onCheckedChange: () => {
          if (readOnly || input.disabled || !input.isConnected) return
          // Vditor's click handler updates its AST, input callback and undo history.
          input.click()
          schedule()
        }
      })]
    })
    reactRoot.render(createElement(Fragment, null, ...controls))
  }

  /** Restores accessibility attributes when a native input leaves the overlay. */
  const restore = (input: HTMLInputElement, original: { hidden: string | null; tabindex: string | null }) => {
    input.classList.remove("vessel-native-task-checkbox")
    if (original.hidden === null) input.removeAttribute("aria-hidden")
    else input.setAttribute("aria-hidden", original.hidden)
    if (original.tabindex === null) input.removeAttribute("tabindex")
    else input.setAttribute("tabindex", original.tabindex)
  }
  /** Coalesces editor mutations and scrolling into one frame. */
  const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(paint) }
  const mutations = new MutationObserver(schedule)
  mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["checked", "disabled"] })
  const size = new ResizeObserver(schedule)
  size.observe(root)
  window.addEventListener("scroll", schedule, true)
  window.addEventListener("resize", schedule)
  root.addEventListener("change", schedule, true)
  schedule()
  return () => {
    disposed = true
    cancelAnimationFrame(frame)
    mutations.disconnect()
    size.disconnect()
    window.removeEventListener("scroll", schedule, true)
    window.removeEventListener("resize", schedule)
    root.removeEventListener("change", schedule, true)
    for (const [input, original] of tracked) restore(input, original)
    tracked.clear()
    queueMicrotask(() => reactRoot.unmount())
    overlay.remove()
  }
}
