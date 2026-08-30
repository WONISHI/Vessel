import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"

interface Position {
  x: number
  y: number
}

interface UseDraggableOptions {
  holdDelay?: number
  moveThreshold?: number
  onDragStart?: () => void
}

export function useDraggable({ holdDelay = 300, moveThreshold = 5, onDragStart }: UseDraggableOptions = {}) {
  const [position, setPosition] = useState<Position | null>(null)

  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    clearTimer()
    isDraggingRef.current = false

    if (cleanupRef.current) {
      const cleanupListeners = cleanupRef.current

      cleanupRef.current = null
      cleanupListeners()
    }
  }, [clearTimer])

  const handleMouseDownCapture = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      // 只处理鼠标右键
      if (e.button !== 2) return

      e.preventDefault()

      cleanup()

      const el = e.currentTarget
      const rect = el.getBoundingClientRect()

      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY
      }

      isDraggingRef.current = false

      const handleMouseMove = (ev: globalThis.MouseEvent) => {
        ev.preventDefault()

        if (isDraggingRef.current) {
          const newX = Math.min(Math.max(0, ev.clientX - offsetX), window.innerWidth - rect.width)

          const newY = Math.min(Math.max(0, ev.clientY - offsetY), window.innerHeight - rect.height)

          setPosition({
            x: newX,
            y: newY
          })

          return
        }

        const moveDistance = Math.hypot(ev.clientX - dragStartRef.current.x, ev.clientY - dragStartRef.current.y)

        if (moveDistance > moveThreshold) {
          clearTimer()
        }
      }

      const handleMouseUp = () => {
        cleanup()
      }

      cleanupRef.current = () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }

      timerRef.current = setTimeout(() => {
        isDraggingRef.current = true
        onDragStart?.()
      }, holdDelay)

      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    },
    [cleanup, clearTimer, holdDelay, moveThreshold, onDragStart]
  )

  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    position,
    handleMouseDownCapture
  }
}
