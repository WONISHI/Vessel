import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react"
import { SearchPanel } from "./search-panel"

/** Keep search content in place until the closing animation has finished. */
export function AnimatedSearchSheet({ onClose, ...panelProps }: Omit<ComponentProps<typeof SearchPanel>, "onClose"> & { onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  const finished = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    clearTimeout(timer.current)
    timer.current = undefined
    onClose()
  }, [onClose])
  const close = () => {
    if (timer.current !== undefined) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return finish()
    setClosing(true)
    timer.current = setTimeout(finish, 340)
  }
  return <section
    aria-label="工作区全文搜索"
    data-state={closing ? "closed" : "open"}
    className="vessel-search-sheet flex h-full w-full min-h-0 flex-col overflow-hidden bg-white"
    onAnimationEnd={event => {
      if (event.target === event.currentTarget && event.animationName === "vessel-search-out" && closing) finish()
    }}
  ><SearchPanel {...panelProps} onClose={close} /></section>
}
