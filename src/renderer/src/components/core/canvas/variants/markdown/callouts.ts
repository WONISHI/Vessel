import { deleteCalloutTitle, insertCalloutTitle } from "./callout-title-edit"
import { parseCalloutHeader } from "@vessel/obsidian"

/** Keep legacy decorative source text in a hidden span, including during title editing. */
function hideLegacyDecoration(paragraph: HTMLElement) {
  const match = /^(\s*\[![\w-]+\][+-]?\s*)(✏\uFE0F?(?:[ \t]*[+-][ \t]*)?)/.exec(paragraph.textContent ?? "")
  if (!match) return
  let offset = match[1].length
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (offset >= node.length) { offset -= node.length; continue }
    if (node.parentElement?.closest("[data-callout-decoration]")) return
    if (offset + match[2].length > node.length) return
    // Splitting text nodes lets the browser retain a caret in the title suffix.
    const decoration = node.splitText(offset)
    decoration.splitText(match[2].length)
    const span = document.createElement("span")
    span.dataset.calloutDecoration = "true"
    span.setAttribute("aria-hidden", "true")
    decoration.replaceWith(span)
    span.append(decoration)
    return
  }
}

/** Hide the directive itself while editing only the title's visible text. */
function hideCalloutDirective(paragraph: HTMLElement) {
  const container = paragraph.querySelector<HTMLElement>(":scope > .vessel-callout-heading") ?? paragraph
  const prefix = /^\s*\[![\w-]+\](?:[ \t]*[+-])?[ \t]*/.exec(container.textContent ?? "")
  if (!prefix) return
  const existing = container.querySelector<HTMLElement>("[data-callout-marker]")
  if (existing?.textContent === prefix[0]) return
  if (existing) existing.replaceWith(...existing.childNodes)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  range.setStart(container, 0)
  let remaining = prefix[0].length
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (remaining <= node.length) { range.setEnd(node, remaining); break }
    remaining -= node.length
  }
  const marker = document.createElement("span")
  marker.dataset.calloutMarker = "true"
  marker.setAttribute("aria-hidden", "true")
  marker.append(range.extractContents())
  container.prepend(marker)
}

/** Decorate source spans only: Lute still serializes the exact original quote text. */
export function decorateCallouts(root: HTMLElement) {
  const quotes = [...(root.matches("blockquote") ? [root] : []), ...root.querySelectorAll<HTMLElement>("blockquote")]
  for (const quote of quotes) {
    const paragraph = quote.firstElementChild
    if (!(paragraph instanceof HTMLElement) || paragraph.tagName !== "P") continue
    let heading = paragraph.querySelector<HTMLElement>(":scope > .vessel-callout-heading")
    const firstLine = (heading?.textContent ?? paragraph.textContent ?? "").split("\n")[0]
    const callout = parseCalloutHeader(firstLine)
    if (!callout) {
      paragraph.querySelectorAll("[data-callout-decoration], [data-callout-marker]").forEach((span) => span.replaceWith(...span.childNodes))
      quote.classList.remove("vessel-callout", "vessel-callout-foldable", "vessel-callout-collapsed")
      delete quote.dataset.calloutType
      delete quote.dataset.calloutSignature
      if (heading) heading.replaceWith(...heading.childNodes)
      continue
    }
    hideCalloutDirective(paragraph)
    hideLegacyDecoration(paragraph)
    if (!heading) {
      const selection = window.getSelection()
      // Do not move the active typing range into a new source span. Focus-out decorates it.
      if (paragraph.closest('[contenteditable="true"]') && root.contains(document.activeElement) && paragraph.contains(selection?.anchorNode ?? null)) continue
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
      let remaining = firstLine.length
      const range = document.createRange()
      range.setStart(paragraph, 0)
      while (walker.nextNode()) {
        const text = walker.currentNode as Text
        if (remaining <= text.length) { range.setEnd(text, remaining); break }
        remaining -= text.length
      }
      heading = document.createElement("span")
      heading.className = "vessel-callout-heading"
      heading.append(range.extractContents())
      paragraph.prepend(heading)
    }
    // Display a plain title without Vditor's bold/italic source markers.
    const visible = heading.cloneNode(true) as HTMLElement
    visible.querySelectorAll(".vditor-ir__marker").forEach((marker) => marker.remove())
    const displayCallout = parseCalloutHeader(visible.textContent ?? "") ?? callout
    heading.dataset.calloutTitle = displayCallout.title
    const signature = `${displayCallout.name}:${displayCallout.foldable}:${displayCallout.expanded}`
    if (quote.dataset.calloutSignature !== signature) quote.classList.toggle("vessel-callout-collapsed", !displayCallout.expanded)
    quote.dataset.calloutSignature = signature
    quote.dataset.calloutType = displayCallout.type
    quote.classList.add("vessel-callout")
    quote.classList.toggle("vessel-callout-foldable", displayCallout.foldable)
    if (displayCallout.foldable) {
      heading.tabIndex = 0
      heading.setAttribute("role", "button")
      heading.setAttribute("aria-label", heading.dataset.calloutTitle || displayCallout.name)
      heading.setAttribute("aria-expanded", String(!quote.classList.contains("vessel-callout-collapsed")))
    } else {
      heading.removeAttribute("tabindex")
      heading.removeAttribute("role")
      heading.removeAttribute("aria-expanded")
      heading.removeAttribute("aria-label")
    }
  }
}

/** Enter finishes a title and moves into the body without letting Vditor split the directive. */
function focusCalloutBody(heading: HTMLElement) {
  const paragraph = heading.parentElement
  const quote = heading.closest<HTMLElement>(".vessel-callout")
  const editable = heading.closest<HTMLElement>('[contenteditable="true"]')
  if (!paragraph || !quote || !editable) return
  decorateCallouts(quote)
  heading.classList.remove("vessel-callout-editing")
  quote.classList.remove("vessel-callout-collapsed")
  if (heading.hasAttribute("aria-expanded")) heading.setAttribute("aria-expanded", "true")
  const range = document.createRange()
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  let body: Text | null = null, offset = 0
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (heading.contains(text)) continue
    const start = text.data.search(/[^\r\n]/)
    if (start >= 0) { body = text; offset = start; break }
  }
  if (body) range.setStart(body, offset)
  else {
    let target = paragraph.nextElementSibling as HTMLElement | null
    if (target?.tagName !== "P") {
      target = document.createElement("p")
      target.dataset.block = "0"
      target.innerHTML = "<br>"
      paragraph.after(target)
    }
    range.setStart(target, 0)
  }
  range.collapse(true)
  editable.focus({ preventScroll: true })
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** Fold state is presentation-only and never changes the stored +/- marker. */
type CalloutMenuTarget = { quote: HTMLElement; x: number; y: number }
export function bindCallouts(root: HTMLElement, onTypeMenu?: (target: CalloutMenuTarget) => void, onBlockMenu?: (target: CalloutMenuTarget) => void, onSourceEdit?: (apply: () => void) => void) {
  const contextMenu = (event: MouseEvent) => {
    const target = event.target as Element
    const quote = target.closest<HTMLElement>(".vessel-callout")
    if (!quote || !root.contains(quote)) return
    const heading = target.closest<HTMLElement>(".vessel-callout-heading")
    const bounds = heading?.getBoundingClientRect()
    const icon = heading && !heading.classList.contains("vessel-callout-editing") && bounds && event.clientX >= bounds.left && event.clientX <= bounds.left + 22
    const open = icon && onTypeMenu ? onTypeMenu : onBlockMenu
    if (!open) return
    event.preventDefault()
    event.stopImmediatePropagation()
    open({ quote, x: event.clientX, y: event.clientY })
  }
  const toggle = (heading: HTMLElement, arrow = false) => {
    const quote = heading.closest<HTMLElement>(".vessel-callout-foldable")
    if (!quote || (!arrow && heading.classList.contains("vessel-callout-editing"))) return
    const collapsed = quote.classList.toggle("vessel-callout-collapsed")
    heading.setAttribute("aria-expanded", String(!collapsed))
  }
  const click = (event: MouseEvent) => {
    const target = event.target as Element
    const quote = target.closest<HTMLElement>(".vessel-callout-foldable")
    const bounds = quote?.getBoundingClientRect()
    if (quote && bounds && event.clientX >= bounds.right - 42 && event.clientY <= bounds.top + 44) {
      const title = quote.querySelector<HTMLElement>(":scope > p:first-child > .vessel-callout-heading")
      if (title) { title.classList.remove("vessel-callout-editing"); toggle(title, true) }
      return
    }
    const heading = target.closest<HTMLElement>(".vessel-callout-heading")
    if (heading && root.contains(heading)) toggle(heading)
  }
  const mousedown = (event: MouseEvent) => {
    const heading = (event.target as Element).closest<HTMLElement>('.vessel-callout-heading[role="button"]')
    if (heading && root.contains(heading) && !heading.classList.contains("vessel-callout-editing")) event.preventDefault()
  }
  const doubleClick = (event: MouseEvent) => {
    const heading = (event.target as Element).closest<HTMLElement>(".vessel-callout-heading")
    const editable = heading?.closest<HTMLElement>('[contenteditable="true"]')
    if (!heading || !editable || !root.contains(heading)) return
    event.preventDefault()
    heading.classList.add("vessel-callout-editing")
    editable.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(heading)
    range.collapse(false)
    const selected = window.getSelection()
    selected?.removeAllRanges()
    selected?.addRange(range)
  }
  const keydown = (event: KeyboardEvent) => {
    const selected = window.getSelection()
    const title = activeTitle()
    const editable = title?.closest<HTMLElement>('[contenteditable="true"]')
    if (event.isComposing) { if (title && document.activeElement === editable) event.stopImmediatePropagation(); return }
    if (title && editable && document.activeElement === editable && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
      // Keep browser text entry, but bypass Vditor's Space/list/inline syntax shortcuts.
      event.stopImmediatePropagation()
      return
    }
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && title && editable && document.activeElement === editable) {
      event.preventDefault()
      event.stopImmediatePropagation()
      const apply = () => focusCalloutBody(title)
      if (onSourceEdit) onSourceEdit(apply)
      else apply()
      return
    }
    if (["Backspace", "Delete"].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey && title && editable && document.activeElement === editable && selected?.rangeCount) {
      const range = selected.getRangeAt(0)
      if (title.contains(range.startContainer) && title.contains(range.endContainer)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const apply = () => {
          deleteCalloutTitle(title, event.key === "Backspace")
          decorateCallouts(title.closest<HTMLElement>(".vessel-callout")!)
        }
        if (onSourceEdit) onSourceEdit(apply)
        else apply()
        return
      }
    }
    const heading = event.target as HTMLElement
    if (heading.matches('.vessel-callout-heading[role="button"]') && ["Enter", " "].includes(event.key)) { event.preventDefault(); toggle(heading) }
  }
  let composingTitle: HTMLElement | null = null
  let compositionFrame = 0
  const activeTitle = () => {
    const selected = window.getSelection()
    if (!selected?.rangeCount) return null
    const range = selected.getRangeAt(0)
    const node = range.startContainer
    let title = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(".vessel-callout-heading")
    // Chromium places a caret beside a span containing only display:none source markers.
    // Bring that boundary back inside the empty title before native insertion can precede [!type].
    if (!title && range.collapsed) {
      const paragraph = (node instanceof Element ? node : node.parentElement)?.closest("p")
      const empty = paragraph?.querySelector<HTMLElement>(":scope > .vessel-callout-heading.vessel-callout-editing")
      if (empty && node === paragraph && !empty.dataset.calloutTitle) {
        title = empty
        const text = document.createTextNode("")
        title.append(text)
        range.setStart(text, 0); range.collapse(true)
        selected.removeAllRanges(); selected.addRange(range)
      }
    }
    return title && root.contains(title) && title.contains(range.endContainer) && document.activeElement === title.closest('[contenteditable="true"]') ? title : null
  }
  const commitTitle = (title: HTMLElement, insert?: string) => {
    const apply = () => {
      if (insert !== undefined) insertCalloutTitle(title, insert)
      const quote = title.closest<HTMLElement>(".vessel-callout")
      if (quote) decorateCallouts(quote)
    }
    if (onSourceEdit) onSourceEdit(apply)
    else apply()
  }
  const beforeInput = (event: InputEvent) => {
    const title = activeTitle()
    if (!title) return
    if (event.isComposing || composingTitle) { event.stopImmediatePropagation(); return }
    if (["insertText", "insertReplacementText"].includes(event.inputType) && event.data !== null && event.cancelable) {
      event.preventDefault()
      event.stopImmediatePropagation()
      commitTitle(title, event.data)
    }
  }
  const paste = (event: ClipboardEvent) => {
    const title = activeTitle()
    if (!title || !event.clipboardData) return
    event.preventDefault()
    event.stopImmediatePropagation()
    commitTitle(title, event.clipboardData.getData("text/plain"))
  }
  const compositionStart = (event: CompositionEvent) => {
    composingTitle = activeTitle()
    if (composingTitle) { cancelAnimationFrame(compositionFrame); event.stopImmediatePropagation() }
  }
  const compositionEnd = (event: CompositionEvent) => {
    if (!composingTitle) return
    event.stopImmediatePropagation()
    const title = composingTitle
    compositionFrame = requestAnimationFrame(() => {
      composingTitle = null
      if (title.isConnected) commitTitle(title)
    })
  }
  const input = (event: Event) => {
    const title = activeTitle()
    if (composingTitle || title) {
      event.stopImmediatePropagation()
      if (!composingTitle && title) commitTitle(title)
    }
  }
  const selection = () => {
    const selected = window.getSelection()
    root.querySelectorAll<HTMLElement>(".vessel-callout-heading").forEach((heading) => {
      const editing = document.activeElement === heading.closest('[contenteditable="true"]') && Boolean(selected && (heading.contains(selected.anchorNode) || heading.contains(selected.focusNode)))
      heading.classList.toggle("vessel-callout-editing", editing)
    })
  }
  root.addEventListener("beforeinput", beforeInput, true)
  root.addEventListener("paste", paste, true)
  root.addEventListener("compositionstart", compositionStart, true)
  root.addEventListener("compositionend", compositionEnd, true)
  root.addEventListener("input", input, true)
  root.addEventListener("contextmenu", contextMenu, true)
  root.addEventListener("mousedown", mousedown)
  root.addEventListener("click", click)
  root.addEventListener("dblclick", doubleClick)
  root.addEventListener("keydown", keydown, true)
  document.addEventListener("selectionchange", selection)
  return () => {
    cancelAnimationFrame(compositionFrame)
    root.removeEventListener("beforeinput", beforeInput, true)
    root.removeEventListener("paste", paste, true)
    root.removeEventListener("compositionstart", compositionStart, true)
    root.removeEventListener("compositionend", compositionEnd, true)
    root.removeEventListener("input", input, true)
    root.removeEventListener("contextmenu", contextMenu, true); root.removeEventListener("mousedown", mousedown); root.removeEventListener("click", click); root.removeEventListener("dblclick", doubleClick); root.removeEventListener("keydown", keydown, true); document.removeEventListener("selectionchange", selection) }
}


/** Replace only the directive's type; keep source title, body and fold markers intact. */
export function changeCalloutType(quote: HTMLElement, name: string): boolean {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) return false
  const heading = quote.querySelector<HTMLElement>(":scope > p:first-child > .vessel-callout-heading")
  if (!heading) return false
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
  const node = walker.nextNode() as Text | null
  if (!node || !/^\s*\[![\w-]+\]/.test(node.data)) return false
  const collapsed = quote.classList.contains("vessel-callout-collapsed")
  node.data = node.data.replace(/^(\s*\[!)[\w-]+(\])/, `$1${name}$2`)
  decorateCallouts(quote)
  quote.classList.toggle("vessel-callout-collapsed", collapsed)
  if (heading.hasAttribute("aria-expanded")) heading.setAttribute("aria-expanded", String(!collapsed))
  return true
}
