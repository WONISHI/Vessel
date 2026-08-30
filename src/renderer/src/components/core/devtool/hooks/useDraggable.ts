import type { MouseEvent as ReactMouseEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

interface Position {
  x: number
  y: number
}

interface UseDraggableOptions {
  enabled?: boolean
  delay?: number
  threshold?: number
  showToast?: boolean
}

interface UseDraggableReturn {
  position: Position | null

  handleMouseDownCapture: (event: ReactMouseEvent<HTMLElement>) => void

  resetPosition: () => void
}

export function useDraggable(options: UseDraggableOptions = {}): UseDraggableReturn {
  const { enabled = true, delay = 300, threshold = 5, showToast: showDragToast = true } = options
  const [position, setPosition] = useState<Position | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({
    x: 0,
    y: 0
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)

      timerRef.current = null
    }

    isDraggingRef.current = false
  }, [])

  const handleMouseDownCapture = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      /**
       * 只处理右键。
       *
       * 左键直接 return，
       * 不会影响 DropdownMenu。
       */
      if (!enabled || event.button !== 2) {
        return
      }

      const element = event.currentTarget
      const rect = element.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top

      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY
      }

      isDraggingRef.current = false

      timerRef.current = setTimeout(() => {
        isDraggingRef.current = true
      }, delay)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) {
          const distance = Math.hypot(moveEvent.clientX - dragStartRef.current.x, moveEvent.clientY - dragStartRef.current.y)

          if (distance > threshold && timerRef.current) {
            clearTimeout(timerRef.current)

            timerRef.current = null
          }

          return
        }

        moveEvent.preventDefault()
        const maxX = Math.max(0, window.innerWidth - rect.width)
        const maxY = Math.max(0, window.innerHeight - rect.height)
        const x = Math.min(Math.max(0, moveEvent.clientX - offsetX), maxX)
        const y = Math.min(Math.max(0, moveEvent.clientY - offsetY), maxY)
        setPosition({
          x,
          y
        })
      }

      const handleMouseUp = () => {
        cleanup()
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    },
    [cleanup, delay, enabled, showDragToast, threshold]
  )

  const resetPosition = useCallback(() => {
    cleanup()
    setPosition(null)
  }, [cleanup])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    position,
    handleMouseDownCapture,
    resetPosition
  }
}

export default useDraggable
