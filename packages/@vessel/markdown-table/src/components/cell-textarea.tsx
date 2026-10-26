import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react"

/** Start at one line and grow to fit wrapped text at the current cell width. */
export const CellTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, forwardedRef) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(forwardedRef, () => ref.current!, [])
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const resize = () => {
      element.style.height = "auto"
      element.style.height = `${Math.max(element.scrollHeight, parseFloat(getComputedStyle(element).lineHeight) || 18)}px`
    }
    resize()
    let width = element.getBoundingClientRect().width
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const nextWidth = element.getBoundingClientRect().width
            if (nextWidth !== width) {
              width = nextWidth
              resize()
            }
          })
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [props.value])
  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      cols={1}
    />
  )
})
CellTextarea.displayName = "CellTextarea"
