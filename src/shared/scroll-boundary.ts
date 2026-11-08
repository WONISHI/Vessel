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
      const markdown = element.matches('[contenteditable="true"]') ? element.closest<HTMLElement>(".vditor-ir, .vditor-wysiwyg, .vditor-sv") : null
      if (markdown && markdown.scrollHeight > markdown.clientHeight + 1) {
        markdown.dispatchEvent(new CustomEvent("vessel:cancel-reveal", { bubbles: true }))
        markdown.scrollTo({ top: top ? 0 : markdown.scrollHeight, behavior: "instant" })
        return true
      }
      const style = getComputedStyle(element)
      if (element.scrollHeight > element.clientHeight + 1 && /auto|scroll|overlay/.test(style.overflowY)) {
        element.dispatchEvent(new CustomEvent("vessel:cancel-reveal", { bubbles: true }))
        element.scrollTo({ top: top ? 0 : element.scrollHeight, behavior: "instant" })
        return true
      }
      element = element.parentElement
    }
  }
  const page = document.scrollingElement
  if (page instanceof HTMLElement && page.scrollHeight > page.clientHeight + 1) {
    page.scrollTo({ top: top ? 0 : page.scrollHeight, behavior: "instant" })
    return true
  }
  return false
}
