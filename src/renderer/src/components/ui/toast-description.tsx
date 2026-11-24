import { useLayoutEffect, useRef, type ReactNode } from "react"

/** Notify Sonner when interactive descriptions change height without replacing their state. */
export function ToastDescription({ children, onResize }: { children?: ReactNode; onResize: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    let height = element.getBoundingClientRect().height
    const observer = new ResizeObserver(() => {
      const next = element.getBoundingClientRect().height
      if (Math.abs(next - height) < 0.5) return
      height = next
      onResize()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [onResize])
  return <div ref={ref} data-toast-description className="min-w-0 w-full">{children}</div>
}
