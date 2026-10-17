import { useLayoutEffect, useRef, useState } from "react"

/** Measures the activity rail and reserves full-size slots for the logo, More and footer controls. */
export function useActivityOverflow(itemCount: number) {
  const railRef = useRef<HTMLElement>(null)
  const [capacity, setCapacity] = useState(itemCount)

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return

    /** Recomputes slots without depending on the number of currently rendered icons. */
    const measure = () => {
      const height = rail.getBoundingClientRect().height
      if (!height) return
      const style = getComputedStyle(rail)
      const padding = (parseFloat(style.paddingTop) || 10) + (parseFloat(style.paddingBottom) || 10)
      // Logo: 30 + 8 margin; footer: two 38px controls + 4px gap.
      // Four gaps separate logo, icon group, More and footer; each icon adds one slot gap.
      const available = height - padding - 38 - 80 - 38 - 16
      setCapacity(Math.max(0, Math.min(itemCount, Math.floor(available / 42))))
    }
    measure()
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure)
    observer?.observe(rail)
    window.addEventListener("resize", measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [itemCount])

  return { railRef, capacity }
}
