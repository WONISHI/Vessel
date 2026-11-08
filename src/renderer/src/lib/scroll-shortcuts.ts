import { scrollBoundary } from "../../../shared/scroll-boundary"
import { matchesShortcut } from "@vessel/utils"

/** Performs the install scroll shortcuts operation. */
export function installScrollShortcuts() {
  let pointer: { x: number; y: number } | undefined

  /** Moves move. */
  const move = (event: PointerEvent) => {
    pointer = { x: event.clientX, y: event.clientY }
  }

  /** Clears clear. */
  const clear = () => {
    pointer = undefined
  }

  /** Performs the key operation. */
  const key = (event: KeyboardEvent) => {
    const top = matchesShortcut(event, "scrollTop")
    if (!top && !matchesShortcut(event, "scrollBottom")) return
    if (!scrollBoundary(top, pointer)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  document.addEventListener("pointermove", move, true)
  document.addEventListener("pointerleave", clear)
  window.addEventListener("blur", clear)
  window.addEventListener("keydown", key, true)
  return () => {
    document.removeEventListener("pointermove", move, true)
    document.removeEventListener("pointerleave", clear)
    window.removeEventListener("blur", clear)
    window.removeEventListener("keydown", key, true)
  }
}
