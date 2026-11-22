import { useCallback, useEffect, useRef, useState, type SetStateAction, type TransitionEvent } from "react"

/** Keep terminal geometry stable until the outer panel has finished closing. */
export function useConsolePresence() {
  const [state, setState] = useState({ open: false, mounted: false, phase: "idle" })
  const current = useRef(false)
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const finish = useCallback(() => {
    clearTimeout(timer.current)
    setState({ open: current.current, mounted: current.current, phase: "idle" })
  }, [])
  const onTransitionEnd = useCallback((event: TransitionEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.id === "terminal" && event.propertyName === "flex-grow") finish()
  }, [finish])
  const setOpen = useCallback((next: SetStateAction<boolean>) => {
    const open = typeof next === "function" ? next(current.current) : next
    if (open === current.current) return
    current.current = open
    clearTimeout(timer.current)
    if (!open) {
      const panel = layoutRef.current?.querySelector<HTMLElement>(":scope > #terminal")
      if (panel) layoutRef.current?.style.setProperty("--console-content-height", `${panel.getBoundingClientRect().height}px`)
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    setState({ open, mounted: open || !reduce, phase: reduce ? "idle" : open ? "enter" : "exit" })
    // The event follows the browser's animation clock. This is only a fallback
    // for hidden layouts, cancelled transitions, or missing transition events.
    if (!reduce) timer.current = setTimeout(finish, open ? 400 : 340)
  }, [finish])
  return { ...state, setOpen, layoutRef, onTransitionEnd }
}
