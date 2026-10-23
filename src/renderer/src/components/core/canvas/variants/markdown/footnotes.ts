import type Vditor from "vditor"

const excluded = '[data-type="code-block"], pre:not(.vditor-reset), img, [data-type="img"], .vessel-image-block, [contenteditable="false"], [data-type="footnotes-ref"], [data-type="footnotes-block"], [data-vessel-footnote-id]'

/** Only real, non-empty text ranges wholly inside the editable document support footnotes. */
export function validFootnoteRange(host: HTMLElement, range: Range | null): range is Range {
  if (
    !range ||
    range.collapsed ||
    !range
      .toString()
      .replace(/\u200b/g, "")
      .trim()
  )
    return false
  const editable = host.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
  if (!editable || !range.startContainer.isConnected || !range.endContainer.isConnected || !editable.contains(range.startContainer) || !editable.contains(range.endContainer)) return false
  for (const endpoint of [range.startContainer, range.endContainer]) {
    const element = endpoint instanceof Element ? endpoint : endpoint.parentElement
    const blocked = element?.closest(excluded)
    if (blocked && editable.contains(blocked)) return false
  }
  const ancestor = range.commonAncestorContainer
  const scope = ancestor instanceof Element ? ancestor : ancestor.parentElement
  return !Array.from(scope?.querySelectorAll(excluded) || []).some((node) => range.intersectsNode(node))
}

/** Keep the toolbar stable and enable footnotes only for eligible text selections. */
export function bindFootnoteToolbar(host: HTMLElement, toolbar: HTMLElement, onSelect: (range: Range) => void) {
  const button = toolbar.querySelector<HTMLButtonElement>('[data-type="footnote"]')
  const item = button?.closest<HTMLElement>(".vditor-toolbar__item")
  if (!button || !item) return () => {}
  const update = () => {
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    item.hidden = false
    button.disabled = !validFootnoteRange(host, range)
    button.setAttribute("aria-disabled", String(button.disabled))
  }
  const preserveSelection = (event: Event) => event.preventDefault()
  const select = (event: Event) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (validFootnoteRange(host, range)) onSelect(range.cloneRange())
  }
  button.addEventListener("pointerdown", preserveSelection)
  button.addEventListener("mousedown", preserveSelection)
  button.addEventListener("click", select, true)
  document.addEventListener("selectionchange", update)
  host.addEventListener("keyup", update)
  host.addEventListener("mouseup", update)
  update()
  return () => {
    document.removeEventListener("selectionchange", update)
    host.removeEventListener("keyup", update)
    host.removeEventListener("mouseup", update)
    button.removeEventListener("pointerdown", preserveSelection)
    button.removeEventListener("mousedown", preserveSelection)
    button.removeEventListener("click", select, true)
  }
}

export function nextFootnoteId(markdown: string): string {
  const used = new Set(Array.from(markdown.matchAll(/\[\^([^\]\s]+)\]/g), (match) => match[1]))
  let id = 1
  while (used.has(String(id))) id++
  return String(id)
}

/** Append only the definition DOM; native input then renders the local reference and records one edit. */
export function insertFootnote(editor: Vditor, host: HTMLElement, range: Range, expectedText: string, content: string): boolean {
  if (!validFootnoteRange(host, range) || range.toString() !== expectedText || !content.trim()) return false
  const editable = host.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')!
  const selection = window.getSelection()
  if (!selection) return false
  const id = nextFootnoteId(editor.getValue())
  const definition = content
    .trim()
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line, index) => (index ? `    ${line}` : line))
    .join("\n")
  const template = document.createElement("template")
  template.innerHTML = editor.vditor.lute.Md2VditorIRDOM(`[^${id}]\n\n[^${id}]: ${definition}`)
  const footnotes = template.content.querySelector<HTMLElement>('[data-type="footnotes-block"]')
  if (!footnotes) return false
  editable.focus({ preventScroll: true })
  selection.removeAllRanges()
  selection.addRange(range.cloneRange())
  editor.vditor.undo?.addToUndoStack(editor.vditor)
  // Persist each selected text fragment's boundaries using lossless inline HTML markers.
  // Plain [^id] syntax alone does not record how much preceding text was selected.
  const selected: Array<{ node: Text; from: number; to: number }> = []
  const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!range.intersectsNode(node) || node.parentElement?.closest('.vditor-ir__marker, [data-type="html-inline"], code')) continue
    const from = node === range.startContainer ? range.startOffset : 0
    const to = node === range.endContainer ? range.endOffset : node.length
    if (to > from) selected.push({ node, from, to })
  }
  const marker = (source: string) => {
    const template = document.createElement("template")
    template.innerHTML = editor.vditor.lute.Md2VditorIRDOM(`x${source}x`)
    return template.content.querySelector('[data-type="html-inline"]')!
  }
  let lastClosing: Node | null = null
  for (const { node, from, to } of selected.reverse()) {
    const fragment = document.createRange()
    fragment.setStart(node, from)
    fragment.setEnd(node, to)
    const close = marker("</span>")
    const end = fragment.cloneRange()
    end.collapse(false)
    end.insertNode(close)
    const start = fragment.cloneRange()
    start.collapse(true)
    start.insertNode(marker(`<span data-vessel-footnote="${id}">`))
    lastClosing ||= close
  }
  const caret = range.cloneRange()
  if (lastClosing) caret.setStartAfter(lastClosing)
  else caret.collapse(false)
  caret.collapse(true)
  selection.removeAllRanges()
  selection.addRange(caret)
  editable.appendChild(footnotes)
  editor.insertValue(`[^${id}]`, true)
  return true
}

/** Vditor owns references; remove its old text tooltip so only the Hover Card appears. */
export function decorateFootnoteReferences(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('sup[data-type="footnotes-ref"]').forEach((reference) => {
    reference.classList.remove("vditor-tooltipped", "vditor-tooltipped__s")
    reference.removeAttribute("title")
  })
}

/** Delete an annotation and its definition while preserving the annotated text and other notes. */
export function deleteFootnote(editor: Vditor, host: HTMLElement, id: string): boolean {
  const editable = host.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
  if (!editable) return false
  const annotations = Array.from(editable.querySelectorAll<HTMLElement>("[data-vessel-footnote-id]")).filter((node) => node.dataset.vesselFootnoteId === id)
  const references = Array.from(editable.querySelectorAll<HTMLElement>('sup[data-type="footnotes-ref"]')).filter((node) => node.getAttribute("data-footnotes-label")?.replace(/^\^/, "") === id)
  const definitions = Array.from(editable.querySelectorAll<HTMLElement>('[data-type="footnotes-def"]')).filter((node) => node.textContent?.trimStart().startsWith(`[^${id}]:`))
  if (!annotations.length && !references.length && !definitions.length) return false
  editor.vditor.undo?.addToUndoStack(editor.vditor)
  let caretNode: Node | null = annotations[0]?.lastChild || references[0]?.previousSibling || null
  while (caretNode?.lastChild) caretNode = caretNode.lastChild
  for (const annotation of annotations) {
    const opening = annotation.previousElementSibling
    const closing = annotation.nextElementSibling
    const source = opening?.querySelector("code")?.textContent || ""
    const template = document.createElement("template")
    template.innerHTML = source
    if (template.content.firstElementChild?.getAttribute("data-vessel-footnote") === id) {
      opening?.remove()
      if (closing?.querySelector("code")?.textContent?.trim() === "</span>") closing.remove()
    }
    annotation.replaceWith(...annotation.childNodes)
  }
  references.forEach((node) => node.remove())
  definitions.forEach((node) => node.remove())
  editable.querySelectorAll('[data-type="footnotes-block"]').forEach((node) => {
    if (!node.querySelector('[data-type="footnotes-def"]')) node.remove()
  })
  const range = document.createRange()
  range.selectNodeContents(caretNode?.isConnected ? caretNode : editable)
  range.collapse(false)
  editable.focus({ preventScroll: true })
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  editor.insertValue("", true)
  return true
}
