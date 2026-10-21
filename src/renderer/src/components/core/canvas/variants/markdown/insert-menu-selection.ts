export type MarkdownInsertLocation = { x: number; y: number; range: Range; slash?: boolean }

/** Saves a caret at the clicked position or typed slash before the menu takes keyboard focus. */
export function bindMarkdownInsertMenu(root: HTMLElement, open: (location: MarkdownInsertLocation) => void, close: () => void = () => {}) {
  let lastTriggerTime = 0
  let slashOpen = false

  const handleSlashTrigger = () => {
    const editable = root.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
    if (!editable) return

    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    const current = selection.getRangeAt(0)
    if (!current.collapsed || !editable.contains(current.commonAncestorContainer)) return

    const element = current.startContainer instanceof Element ? current.startContainer : current.startContainer.parentElement
    // Vditor's editable root is itself a <pre class="vditor-reset">, so only match blockers inside it.
    const blocker = element?.closest('table, input, textarea, button, [contenteditable="false"], [data-type="code-block"], code, pre')
    if (!element || (blocker && blocker !== editable)) return

    // Slash commands belong only to an otherwise empty standalone paragraph.
    if (element.closest("li,ul,ol,blockquote,h1,h2,h3,h4,h5,h6")) return
    const paragraph = element.closest<HTMLElement>("p,div[data-block]") ?? editable
    if (!editable.contains(paragraph) || paragraph.textContent?.replace(/[\u200b\ufeff]/g, "").trim() !== "/") return
    if (current.startContainer.nodeType !== Node.TEXT_NODE || current.startOffset < 1 || current.startContainer.textContent?.[current.startOffset - 1] !== "/") return

    const now = Date.now()
    if (now - lastTriggerTime < 150) return
    lastTriggerTime = now

    const slashRange = current.cloneRange()
    if (slashRange.startOffset > 0) {
      slashRange.setStart(slashRange.startContainer, slashRange.startOffset - 1)
    }

    // Anchor at the typed "/" glyph (a non-collapsed range has a reliable rect); fall back to the caret / its line.
    const pick = (r: Range) => Array.from(r.getClientRects?.() || []).find((rect) => rect.width || rect.height)
    const rect = pick(slashRange) || pick(current)
      || (current.startContainer instanceof Element ? current.startContainer : current.startContainer.parentElement)?.getBoundingClientRect()
    if (!rect) return

    // The trigger sits right below the slash; Radix flips/shifts on viewport collisions itself.
    slashOpen = true
    open({ x: rect.left, y: rect.bottom, range: slashRange, slash: true })
  }

  const isSlash = (data?: string | null) => data === "/"
  // Defer until Vditor has finished re-rendering the edited block and restoring the caret.
  const scheduleTrigger = () => setTimeout(handleSlashTrigger, 30)

  const handleInput = (event: Event) => {
    if (slashOpen) { slashOpen = false; close() }
    const data = (event as InputEvent).data
    if (isSlash(data) && !(event as InputEvent).isComposing) scheduleTrigger()
  }

  const handleCompositionEnd = (event: CompositionEvent) => {
    if (isSlash(event.data)) scheduleTrigger()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (!event.isComposing && isSlash(event.key)) scheduleTrigger()
  }

  /** Leaves table actions and embedded controls to their existing context menus. */
  const contextmenu = (event: MouseEvent) => {
    if (event.defaultPrevented || !(event.target instanceof HTMLElement)) return
    const target = event.target
    const editable = root.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
    if (!editable || !target.closest(".vditor-ir") || target.closest('table, input, textarea, button, [contenteditable="false"]')) return
    event.preventDefault()
    event.stopPropagation()
    const selection = window.getSelection()
    const current = selection?.rangeCount ? selection.getRangeAt(0) : null
    const insideSelection = current && !current.collapsed && editable.contains(current.commonAncestorContainer)
      && Array.from(current.getClientRects()).some((rect) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)
    let range = insideSelection ? current.cloneRange() : document.caretRangeFromPoint?.(event.clientX, event.clientY)
    if (!range || !editable.contains(range.commonAncestorContainer)) {
      range = document.createRange()
      range.selectNodeContents(editable)
      range.collapse(false)
    }
    slashOpen = false
    open({ x: event.clientX, y: event.clientY, range: range.cloneRange() })
  }

  root.addEventListener("contextmenu", contextmenu)
  root.addEventListener("input", handleInput, true)
  root.addEventListener("keydown", handleKeyDown, true)
  root.addEventListener("compositionend", handleCompositionEnd, true)

  return () => {
    root.removeEventListener("compositionend", handleCompositionEnd, true)
    root.removeEventListener("contextmenu", contextmenu)
    root.removeEventListener("input", handleInput, true)
    root.removeEventListener("keydown", handleKeyDown, true)
  }
}
