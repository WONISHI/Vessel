import { GripVertical } from "lucide-react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/** Includes subordinate headings, stopping at a peer, parent or footnote definitions. */
export function headingBlockRange(heading: HTMLElement) {
  if (!heading.isConnected) return null
  const level = Number(heading.tagName.slice(1))
  let end: Element = heading
  while (end.nextElementSibling) {
    const next = end.nextElementSibling
    if (/^H[1-6]$/.test(next.tagName) && Number(next.tagName.slice(1)) <= level || next.matches('[data-type="footnotes-block"]')) break
    end = next
  }
  const range = document.createRange()
  range.setStartBefore(heading)
  range.setEndAfter(end)
  return range
}

/** Keeps decorative handles outside the document so they cannot enter saved Markdown. */
export function bindHeadingHandles(root: HTMLElement, onMenu: (heading: HTMLElement, x: number, y: number) => void) {
  const handles = new Map<HTMLElement, HTMLButtonElement>()
  let frame = 0
  const update = () => {
    frame = 0
    const editable = root.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
    const headings = new Set(Array.from(editable?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6") ?? []).filter((heading) => !heading.closest('[contenteditable="false"], [data-type="code-block"], [data-type="footnotes-block"]')))
    for (const [heading, button] of handles) {
      if (!headings.has(heading)) { button.remove(); handles.delete(heading) }
    }
    const bounds = root.getBoundingClientRect()
    for (const heading of headings) {
      let button = handles.get(heading)
      if (!button) {
        button = document.createElement("button")
        button.type = "button"
        button.className = "vessel-heading-grip"
        button.setAttribute("aria-label", "选择标题及内容")
        button.innerHTML = renderToStaticMarkup(createElement(GripVertical, { size: 14 }))
        const select = () => {
          const range = headingBlockRange(heading)
          if (!range) return
          editable?.focus({ preventScroll: true })
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
        }
        button.onmousedown = (event) => { event.preventDefault(); event.stopPropagation(); select() }
        button.oncontextmenu = (event) => {
          event.preventDefault()
          event.stopPropagation()
          select()
          onMenu(heading, event.clientX, event.clientY)
        }
        document.body.append(button)
        handles.set(heading, button)
      }
      const rect = heading.getBoundingClientRect()
      button.hidden = !root.getClientRects().length || rect.top < bounds.top || rect.bottom > bounds.bottom || rect.top < 0 || rect.top > innerHeight
      button.style.left = `${Math.max(bounds.left, rect.left - 22)}px`
      button.style.top = `${rect.top + Math.max(0, (Math.min(rect.height, 32) - 20) / 2)}px`
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
  const observer = new MutationObserver(schedule)
  observer.observe(root, { childList: true, subtree: true, characterData: true })
  const resize = new ResizeObserver(schedule)
  resize.observe(root)
  window.addEventListener("scroll", schedule, true)
  window.addEventListener("resize", schedule)
  schedule()
  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    resize.disconnect()
    window.removeEventListener("scroll", schedule, true)
    window.removeEventListener("resize", schedule)
    handles.forEach((button) => button.remove())
    handles.clear()
  }
}
