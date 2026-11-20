import { useEffect, type RefObject } from "react"

/** Use a non-passive listener so Ctrl + wheel zooms the image instead of the page. */
export function useCtrlWheelZoom(ref: RefObject<HTMLElement | null>, onZoom: (direction: 1 | -1) => void, enabled = true) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey || !event.deltaY || event.defaultPrevented) return
      event.preventDefault()
      event.stopPropagation()
      onZoom(event.deltaY < 0 ? 1 : -1)
    }
    element.addEventListener("wheel", wheel, { passive: false })
    return () => element.removeEventListener("wheel", wheel)
  }, [ref, onZoom, enabled])
}
