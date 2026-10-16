import { useEffect, useRef, useState, type PointerEvent } from "react"

/** Short clicks open the menu; holding the primary pointer enables dragging. */
export function useDraggable() {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const cleanup = useRef<(() => void) | null>(null)
  const suppressClick = useRef(false)
  useEffect(() => () => cleanup.current?.(), [])

  /** Handles pointer down events. */
  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault() // Radix normally opens on pointer-down, before a long press can finish.
    cleanup.current?.()
    suppressClick.current = false
    const element = event.currentTarget,
      rect = element.getBoundingClientRect()
    const start = { x: event.clientX, y: event.clientY },
      id = event.pointerId
    let active = false
    let shield: HTMLStyleElement | undefined
    element.setPointerCapture(id)
    const timer = setTimeout(() => {
      active = true
      suppressClick.current = true
      setDragging(true)
      shield = document.createElement("style")
      shield.textContent = "webview,iframe{pointer-events:none!important}"
      document.head.append(shield)
    }, 350)

    /** Moves move. */
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== id) return
      if (!active) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) {
          clearTimeout(timer)
          suppressClick.current = true
        }
        return
      }
      e.preventDefault()
      setPosition({ x: Math.max(0, Math.min(innerWidth - rect.width, rect.left + e.clientX - start.x)), y: Math.max(0, Math.min(innerHeight - rect.height, rect.top + e.clientY - start.y)) })
    }

    /** Stops stop. */
    const stop = () => {
      clearTimeout(timer)
      shield?.remove()
      setDragging(false)
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
      window.removeEventListener("blur", stop)
      cleanup.current = null
    }
    cleanup.current = stop
    window.addEventListener("pointermove", move, { passive: false })
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
    window.addEventListener("blur", stop)
  }
  return {
    position,
    dragging,
    handlePointerDown,

    /** Performs the consume drag click operation. */
    consumeDragClick: () => {
      const consumed = suppressClick.current
      suppressClick.current = false
      return consumed
    }
  }
}
