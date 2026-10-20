import { useEffect, useRef } from "react"

/** Calculates the directional scrolling speed based on cursor position relative to viewport boundaries. */
export function calculateDragScrollSpeed(
  cursorY: number,
  rectTop: number,
  rectBottom: number,
  threshold = 44,
  minSpeed = 2,
  maxSpeed = 14
): number {
  const height = rectBottom - rectTop
  if (height <= 0) return 0
  const activeThreshold = Math.min(threshold, Math.floor(height / 4))

  // Near top boundary or slightly above in header zone
  if (cursorY <= rectTop + activeThreshold && cursorY >= rectTop - 60) {
    const dist = Math.max(0, rectTop + activeThreshold - cursorY)
    const ratio = Math.min(1, dist / activeThreshold)
    return -(minSpeed + (maxSpeed - minSpeed) * (ratio * ratio))
  }

  // Near bottom boundary or slightly below
  if (cursorY >= rectBottom - activeThreshold && cursorY <= rectBottom + 60) {
    const dist = Math.max(0, cursorY - (rectBottom - activeThreshold))
    const ratio = Math.min(1, dist / activeThreshold)
    return minSpeed + (maxSpeed - minSpeed) * (ratio * ratio)
  }

  return 0
}

interface UseTreeDragAutoScrollOptions {
  viewport: HTMLElement | null
  onHoverPath?: (path: string | undefined) => void
  onDropRoot?: (event: DragEvent) => void
  threshold?: number
  minSpeed?: number
  maxSpeed?: number
}

/**
 * Automatically scrolls the tree viewport when dragging items near the top or bottom boundaries,
 * matching VS Code's file tree drag-and-drop boundary scrolling behavior.
 */
export function useTreeDragAutoScroll({
  viewport,
  onHoverPath,
  onDropRoot,
  threshold = 44,
  minSpeed = 2,
  maxSpeed = 14
}: UseTreeDragAutoScrollOptions) {
  const isDraggingRef = useRef(false)
  const speedRef = useRef(0)
  const frameIdRef = useRef(0)
  const coordsRef = useRef({ x: 0, y: 0 })
  const callbacksRef = useRef({ onHoverPath, onDropRoot })

  callbacksRef.current = { onHoverPath, onDropRoot }

  useEffect(() => {
    if (!viewport) return

    const stopScroll = () => {
      speedRef.current = 0
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
        frameIdRef.current = 0
      }
    }

    const stopAll = () => {
      isDraggingRef.current = false
      stopScroll()
    }

    const scrollStep = () => {
      if (!isDraggingRef.current || speedRef.current === 0 || !viewport) {
        frameIdRef.current = 0
        return
      }

      const { scrollTop, scrollHeight, clientHeight } = viewport
      const maxScroll = Math.max(0, scrollHeight - clientHeight)
      const speed = speedRef.current

      if (speed < 0) {
        if (scrollTop <= 0) {
          frameIdRef.current = 0
          return
        }
        viewport.scrollTop = Math.max(0, scrollTop + speed)
      } else if (speed > 0) {
        if (scrollTop >= maxScroll) {
          frameIdRef.current = 0
          return
        }
        viewport.scrollTop = Math.min(maxScroll, scrollTop + speed)
      }

      // Update the hovered node under the cursor as the tree scrolls underneath
      if (callbacksRef.current.onHoverPath && coordsRef.current.x > 0 && coordsRef.current.y > 0 && typeof document.elementFromPoint === "function") {
        const el = document.elementFromPoint(coordsRef.current.x, coordsRef.current.y)
        const row = el?.closest<HTMLElement>("[data-node-path]")
        callbacksRef.current.onHoverPath(row?.dataset.nodePath)
      }

      frameIdRef.current = requestAnimationFrame(scrollStep)
    }

    const startScroll = () => {
      if (frameIdRef.current) return
      frameIdRef.current = requestAnimationFrame(scrollStep)
    }

    const isFileDrag = (event: DragEvent) => {
      const types = event.dataTransfer?.types
      return Boolean(types?.includes("application/x-vessel-files") || types?.includes("Files"))
    }

    const handleDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return

      isDraggingRef.current = true
      coordsRef.current = { x: event.clientX, y: event.clientY }

      const rect = viewport.getBoundingClientRect()
      const x = event.clientX
      const y = event.clientY

      // Must be roughly within horizontal bounds of the viewport
      if (x < rect.left - 30 || x > rect.right + 30) {
        stopScroll()
        return
      }

      const speed = calculateDragScrollSpeed(y, rect.top, rect.bottom, threshold, minSpeed, maxSpeed)
      if (speed !== 0) {
        speedRef.current = speed
        startScroll()
      } else {
        stopScroll()
      }
    }

    const handleViewportDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = event.dataTransfer.types.includes("application/x-vessel-files") ? "move" : "copy"
      }
      handleDragOver(event)
    }

    const handleViewportDragLeave = (event: DragEvent) => {
      if (event.relatedTarget && viewport.contains(event.relatedTarget as Node)) return
      stopScroll()
    }

    const handleViewportDrop = (event: DragEvent) => {
      stopAll()
      if (event.defaultPrevented) return
      callbacksRef.current.onDropRoot?.(event)
    }

    viewport.addEventListener("dragover", handleViewportDragOver)
    viewport.addEventListener("dragleave", handleViewportDragLeave)
    viewport.addEventListener("drop", handleViewportDrop)

    // Window listeners ensure boundary scrolling continues if cursor goes slightly into header or edges
    window.addEventListener("dragover", handleDragOver)
    window.addEventListener("dragend", stopAll)
    window.addEventListener("drop", stopAll)

    return () => {
      stopAll()
      viewport.removeEventListener("dragover", handleViewportDragOver)
      viewport.removeEventListener("dragleave", handleViewportDragLeave)
      viewport.removeEventListener("drop", handleViewportDrop)
      window.removeEventListener("dragover", handleDragOver)
      window.removeEventListener("dragend", stopAll)
      window.removeEventListener("drop", stopAll)
    }
  }, [viewport, threshold, minSpeed, maxSpeed])
}
