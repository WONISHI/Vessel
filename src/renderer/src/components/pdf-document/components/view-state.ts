import { useLayoutEffect, useRef, useState } from "react"

type PdfView = { top: number; left: number; zoom: number }
const views = new Map<string, PdfView>()

/** Retain each preview's position while the sheet and PDF pages are unmounted. */
export function usePdfViewState(key: string, ready: boolean, width: number) {
  const viewport = useRef<HTMLDivElement>(null)
  const saved = useRef(views.get(key))
  const [zoom, setZoom] = useState(() => saved.current?.zoom || 1)
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element || !ready) return
    const state = saved.current
    if (state) {
      element.scrollTop = state.top
      element.scrollLeft = state.left
    }
  }, [ready, width])
  const remember = () => {
    const element = viewport.current
    if (!element || !ready) return
    const state = { top: element.scrollTop, left: element.scrollLeft, zoom }
    saved.current = state
    views.delete(key)
    views.set(key, state)
    if (views.size > 100) views.delete(views.keys().next().value!)
  }
  useLayoutEffect(remember, [zoom, ready])
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    element.addEventListener("scroll", remember, { passive: true })
    return () => element.removeEventListener("scroll", remember)
  }, [key, ready, zoom])
  return { viewport, zoom, setZoom }
}
