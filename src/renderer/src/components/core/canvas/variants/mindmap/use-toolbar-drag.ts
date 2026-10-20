import { useEffect, useRef, useState, type PointerEvent } from "react"

/** Moves the floating toolbar by its handle and keeps it inside its canvas. */
export function useToolbarDrag() {
  const toolbar = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null)

  /** Constrains the toolbar to its current canvas dimensions. */
  const constrain = (left: number, top: number) => {
    const element = toolbar.current
    const parent = element?.parentElement
    if (!element || !parent) return { left, top }
    return {
      left: Math.max(0, Math.min(left, parent.clientWidth - element.offsetWidth)),
      top: Math.max(0, Math.min(top, parent.clientHeight - element.offsetHeight))
    }
  }

  useEffect(() => {
    const parent = toolbar.current?.parentElement
    if (!parent || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => setPosition((current) => current ? constrain(current.left, current.top) : null))
    observer.observe(parent)
    if (toolbar.current) observer.observe(toolbar.current)
    return () => observer.disconnect()
  }, [])

  /** Captures pointer movement only from the dedicated drag handle. */
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !toolbar.current?.parentElement) return
    event.preventDefault()
    event.stopPropagation()
    const rect = toolbar.current.getBoundingClientRect()
    const parent = toolbar.current.parentElement.getBoundingClientRect()
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left - parent.left, top: rect.top - parent.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  /** Updates the toolbar without moving mind-map nodes or the canvas. */
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    if (!start || start.id !== event.pointerId) return
    event.stopPropagation()
    setPosition(constrain(start.left + event.clientX - start.x, start.top + event.clientY - start.y))
  }

  /** Ends dragging on release, cancellation or capture loss. */
  const stop = () => { drag.current = null }

  return {
    toolbar,
    style: position ? { left: position.left, top: position.top, bottom: "auto", transform: "none" } : undefined,
    handleProps: { onPointerDown, onPointerMove, onPointerUp: stop, onPointerCancel: stop, onLostPointerCapture: stop }
  }
}
