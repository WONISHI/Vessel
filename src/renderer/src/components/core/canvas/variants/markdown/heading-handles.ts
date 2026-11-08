import { GripVertical, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, ChevronRight, SquareDashed } from "lucide-react"
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

const doubleClickSelections = new WeakSet<HTMLElement>()

/** Only the handle's double-click grants block-copy permission. */
export function selectHeadingBlock(heading: HTMLElement) {
  const range = headingBlockRange(heading)
  if (!range) return
  heading.closest<HTMLElement>('[contenteditable="true"]')?.focus({ preventScroll: true })
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(range)
  doubleClickSelections.add(heading)
}

export function canCopyHeadingBlock(heading: HTMLElement) {
  const selection = window.getSelection()
  const block = headingBlockRange(heading)
  if (!doubleClickSelections.has(heading) || !block || !selection?.rangeCount || selection.isCollapsed) return false
  const selected = selection.getRangeAt(0)
  return selected.compareBoundaryPoints(Range.START_TO_START, block) === 0 && selected.compareBoundaryPoints(Range.END_TO_END, block) === 0
}

/** Keeps decorative handles outside the document so they cannot enter saved Markdown. */
export function bindHeadingHandles(root: HTMLElement, onMenu: (heading: HTMLElement, x: number, y: number) => void, toolbarHost?: HTMLElement | null) {
  const handles = new Map<HTMLElement, HTMLButtonElement>()
  const headingIcons = [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6]
  let focusedSection: HTMLElement | null = null
  let reportedFocus: HTMLElement | null = null
  const exitFocus = document.createElement("button")
  exitFocus.type = "button"
  exitFocus.className = "vessel-heading-exit-focus"
  exitFocus.setAttribute("aria-label", "退出专注")
  exitFocus.setAttribute("data-title", "退出专注")
  exitFocus.innerHTML = renderToStaticMarkup(createElement(SquareDashed, { size: 18 })).replace("</svg>", '<path d="m9 9 6 6m0-6-6 6"/></svg>')
  exitFocus.hidden = true
  let hoveredHeading: HTMLElement | null = null
  let clickTimer: ReturnType<typeof setTimeout> | undefined
  let frame = 0
  const update = () => {
    frame = 0
    const editable = root.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
    const headings = new Set(Array.from(editable?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6") ?? []).filter((heading) => !heading.closest('[contenteditable="false"], [data-type="code-block"], [data-type="footnotes-block"]')))
    for (const [heading, button] of handles) {
      if (!headings.has(heading)) { button.remove(); handles.delete(heading) }
    }
    if (focusedSection && !focusedSection.isConnected) focusedSection = null
    const toolbarElement = toolbarHost?.querySelector(".vditor-toolbar") ?? root.querySelector(".vditor-toolbar")
    if (toolbarElement && exitFocus.parentElement !== toolbarElement) toolbarElement.append(exitFocus)
    exitFocus.hidden = !focusedSection
    if (editable) {
      const range = focusedSection ? headingBlockRange(focusedSection) : null
      for (const node of Array.from(editable.children)) node.classList.toggle("vessel-heading-focus-hidden", !!range && !range.intersectsNode(node))
      const folded: number[] = []
      for (const node of Array.from(editable.children)) {
        const level = /^H[1-6]$/.test(node.tagName) ? Number(node.tagName.slice(1)) : 0
        if (level) while (folded.length && folded[folded.length - 1] >= level) folded.pop()
        node.classList.toggle("vessel-heading-fold-hidden", folded.length > 0 && !node.matches('[data-type="footnotes-block"]'))
        if (level && node.classList.contains("vessel-heading-folded")) folded.push(level)
      }
    }
    const bounds = root.getBoundingClientRect()
    const viewport = editable?.closest<HTMLElement>(".vditor-ir")?.getBoundingClientRect()
    const toolbar = root.querySelector<HTMLElement>(".vditor-toolbar")?.getBoundingClientRect()
    // Handles live in body: explicitly clip them to the editor viewport and below its sticky toolbar.
    let visibleTop = Math.max(0, bounds.top, viewport?.top ?? bounds.top, toolbar?.bottom ?? bounds.top)
    let visibleBottom = Math.min(innerHeight, bounds.bottom, viewport?.bottom ?? bounds.bottom)
    for (let parent = root.parentElement; parent; parent = parent.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowY)) {
        const clip = parent.getBoundingClientRect()
        visibleTop = Math.max(visibleTop, clip.top)
        visibleBottom = Math.min(visibleBottom, clip.bottom)
      }
    }
    for (const heading of headings) {
      let button = handles.get(heading)
      if (!button) {
        button = document.createElement("button")
        button.type = "button"
        button.className = "vessel-heading-grip"
        button.setAttribute("aria-label", "单击打开菜单，双击选择标题及内容")
        button.innerHTML = `<span class="vessel-heading-level">${renderToStaticMarkup(createElement(headingIcons[Number(heading.tagName.slice(1)) - 1], { size: 14 }))}</span><span class="vessel-heading-drag">${renderToStaticMarkup(createElement(GripVertical, { size: 14 }))}</span>`
        const foldIcon = document.createElement("span")
        foldIcon.className = "vessel-heading-fold-indicator"
        foldIcon.innerHTML = renderToStaticMarkup(createElement(ChevronRight, { size: 14 }))
        foldIcon.onclick = (event) => {
          event.preventDefault()
          event.stopPropagation()
          clearTimeout(clickTimer)
          heading.classList.remove("vessel-heading-folded")
          schedule()
        }
        button.prepend(foldIcon)
        const select = () => selectHeadingBlock(heading)
        button.onmousedown = (event) => { event.preventDefault(); event.stopPropagation() }
        button.onclick = (event) => {
          event.preventDefault()
          event.stopPropagation()
          clearTimeout(clickTimer)
          if (event.detail > 1) return
          const { clientX, clientY } = event
          clickTimer = setTimeout(() => { if (heading.isConnected) onMenu(heading, clientX, clientY) }, 350)
        }
        button.ondblclick = (event) => { clearTimeout(clickTimer); event.preventDefault(); event.stopPropagation(); select() }
        button.oncontextmenu = (event) => {
          event.preventDefault()
          event.stopPropagation()
          clearTimeout(clickTimer)
          onMenu(heading, event.clientX, event.clientY)
        }
        document.body.append(button)
        handles.set(heading, button)
      }
      const selection = window.getSelection()
      const focused = !!editable?.contains(window.document.activeElement) && !!selection?.anchorNode && heading.contains(selection.anchorNode)
      button.classList.toggle("is-heading-focused", focused)
      button.classList.toggle("is-heading-folded", heading.classList.contains("vessel-heading-folded"))
      button.classList.toggle("is-heading-hovered", hoveredHeading === heading)
      const rect = heading.getBoundingClientRect()
      button.hidden = !heading.getClientRects().length || !root.getClientRects().length || rect.top < visibleTop || rect.top + 20 > visibleBottom
      button.style.left = `${Math.max(bounds.left, rect.left - 18)}px`
      button.style.top = `${rect.top + Math.max(0, (Math.min(rect.height, 32) - 20) / 2)}px`
    }
    if (reportedFocus !== focusedSection) {
      reportedFocus = focusedSection
      root.dispatchEvent(new CustomEvent("vessel:heading-visibility", { bubbles: true }))
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
  const onPointerMove = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : null
    // Keep the handle available while moving across the small gap beside the title.
    const handle = target?.closest(".vessel-heading-grip")
    let next: HTMLElement | null = null
    if (handle) {
      for (const [heading, button] of handles) if (button === handle) { next = heading; break }
    } else {
      for (const heading of handles.keys()) {
        const rect = heading.getBoundingClientRect()
        if (event.clientY >= rect.top && event.clientY <= rect.bottom && event.clientX >= rect.left - 18 && event.clientX <= rect.right) {
          next = heading
          break
        }
      }
    }
    if (next !== hoveredHeading) { hoveredHeading = next; schedule() }
  }
  const focusSection = (event: Event) => {
    const heading = (event as CustomEvent<HTMLElement>).detail
    if (heading instanceof HTMLElement && root.contains(heading)) {
      focusedSection = heading
      heading.classList.remove("vessel-heading-folded")
      schedule()
    }
  }
  exitFocus.onclick = () => { focusedSection = null; schedule() }
  const onPointerLeave = () => { hoveredHeading = null; schedule() }
  const observer = new MutationObserver(schedule)
  observer.observe(root, { childList: true, subtree: true, characterData: true })
  const resize = new ResizeObserver(schedule)
  resize.observe(root)
  window.addEventListener("scroll", schedule, true)
  window.addEventListener("resize", schedule)
  document.addEventListener("selectionchange", schedule)
  document.addEventListener("pointermove", onPointerMove)
  document.documentElement.addEventListener("pointerleave", onPointerLeave)
  root.addEventListener("focusin", schedule)
  root.addEventListener("focusout", schedule)
  root.addEventListener("vessel:heading-fold", schedule)
  root.addEventListener("vessel:heading-focus", focusSection)
  schedule()
  return () => {
    clearTimeout(clickTimer)
    cancelAnimationFrame(frame)
    observer.disconnect()
    resize.disconnect()
    window.removeEventListener("scroll", schedule, true)
    window.removeEventListener("resize", schedule)
    document.removeEventListener("selectionchange", schedule)
    document.removeEventListener("pointermove", onPointerMove)
    document.documentElement.removeEventListener("pointerleave", onPointerLeave)
    root.removeEventListener("focusin", schedule)
    root.removeEventListener("focusout", schedule)
    root.removeEventListener("vessel:heading-fold", schedule)
    root.removeEventListener("vessel:heading-focus", focusSection)
    exitFocus.remove()
    root.querySelectorAll(".vessel-heading-focus-hidden").forEach((node) => node.classList.remove("vessel-heading-focus-hidden"))
    handles.forEach((button) => button.remove())
    handles.clear()
    root.querySelectorAll(".vessel-heading-folded, .vessel-heading-fold-hidden").forEach((node) => node.classList.remove("vessel-heading-folded", "vessel-heading-fold-hidden"))
  }
}
