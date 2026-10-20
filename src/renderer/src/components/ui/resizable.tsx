import { cn } from "@/lib/utils"
import { useRef, useState, type ReactNode } from "react"

export interface ResizableProps {
  children: ReactNode
  className?: string
  defaultWidth?: number
  defaultWidthPercent?: number
  minWidth?: number
  maxWidth?: number
  onResizeEnd?: (width: number) => void
}
/** 单内容尺寸容器：指针拖动和方向键均可调整宽度，高度由内容比例决定。 */
export function Resizable({ children, className, defaultWidth = 480, defaultWidthPercent, minWidth = 80, maxWidth = 1600, onResizeEnd }: ResizableProps) {
  const [width, setWidth] = useState<number | null>(defaultWidthPercent === undefined ? Math.max(minWidth, Math.min(defaultWidth, maxWidth)) : null)
  const container = useRef<HTMLSpanElement>(null)
  /** Reads the rendered percentage width when the user starts resizing. */
  const currentWidth = () => width ?? container.current?.getBoundingClientRect().width ?? defaultWidth
  const drag = useRef<{ x: number; width: number } | null>(null)

  /** Performs the change operation. */
  const change = (value: number) => setWidth(Math.max(minWidth, Math.min(value, maxWidth)))
  return (
    <span
      ref={container}
      className={cn("group relative inline-block max-w-full align-top", className)}
      style={{ width: width ?? `${defaultWidthPercent}%` }}
    >
      {children}
      <span
        role="slider"
        tabIndex={0}
        aria-label="调整图片宽度"
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuenow={width === null ? undefined : Math.round(width)}
        aria-valuetext={width === null ? `${defaultWidthPercent}%` : undefined}
        className="absolute bottom-0 right-0 size-4 cursor-nwse-resize touch-none rounded-tl border-b-2 border-r-2 border-green-600 bg-white/80 opacity-0 group-hover:opacity-100 focus:opacity-100"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          drag.current = { x: event.clientX, width: currentWidth() }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (drag.current) change(drag.current.width + event.clientX - drag.current.x)
        }}
        onPointerUp={(event) => {
          if (drag.current) {
            drag.current = null
            event.currentTarget.releasePointerCapture(event.pointerId)
            onResizeEnd?.(currentWidth())
          }
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault()
            const next = Math.max(minWidth, Math.min(currentWidth() + (event.key === "ArrowRight" ? 10 : -10), maxWidth))
            change(next)
            onResizeEnd?.(next)
          }
        }}
      />
    </span>
  )
}
