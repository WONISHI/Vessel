/** Finds the actual scroller under the pointer, falling back to keyboard focus. */
export function scrollBoundary(top: boolean, pointer?: { x: number; y: number }) {
  const hovered = pointer ? document.elementFromPoint(pointer.x, pointer.y) : null
  for (const start of [hovered, document.activeElement]) {
    let element = start instanceof HTMLElement ? start : start?.parentElement
    while (element) {
      if (element.dataset.vesselScroll === "code") {
        element.dispatchEvent(new CustomEvent("vessel:scroll-boundary", { detail: top }))
        return true
      }
      const style = getComputedStyle(element)
      if (element.scrollHeight > element.clientHeight + 1 && /auto|scroll|overlay/.test(style.overflowY)) {
        element.scrollTo({ top: top ? 0 : element.scrollHeight, behavior: "smooth" })
        return true
      }
      element = element.parentElement
    }
  }
  const page = document.scrollingElement
  if (page instanceof HTMLElement && page.scrollHeight > page.clientHeight + 1) {
    page.scrollTo({ top: top ? 0 : page.scrollHeight, behavior: "smooth" })
    return true
  }
  return false
}
