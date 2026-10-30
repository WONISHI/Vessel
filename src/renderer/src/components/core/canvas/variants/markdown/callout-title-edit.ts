const sourceMarkers = "[data-callout-marker], [data-callout-decoration], .vditor-ir__marker"

/** Delete visible title text locally, keeping the directive and the editor's caret intact. */
function editCalloutTitle(heading: HTMLElement, edit: { insert: string } | { backward: boolean }): boolean {
  const selection = window.getSelection()
  const editable = heading.closest<HTMLElement>('[contenteditable="true"]')
  if (!editable || document.activeElement !== editable || !selection?.rangeCount) return false
  const original = selection.getRangeAt(0)
  if (!heading.contains(original.startContainer) || !heading.contains(original.endContainer)) return false
  const visibleBefore = (container: Node, offset: number) => {
    const range = document.createRange()
    range.setStart(heading, 0)
    range.setEnd(container, offset)
    const fragment = range.cloneContents()
    fragment.querySelectorAll(sourceMarkers).forEach((node) => node.remove())
    return fragment.textContent?.length ?? 0
  }
  const nodes = () => {
    const result: Text[] = []
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      if (!node.parentElement?.closest(sourceMarkers)) result.push(node)
    }
    return result
  }
  const texts = nodes()
  const value = texts.map((node) => node.data).join("")
  let start = visibleBefore(original.startContainer, original.startOffset)
  let end = visibleBefore(original.endContainer, original.endOffset)
  if (start === end && "backward" in edit) {
    const boundaries = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].map((segment) => segment.index)
    boundaries.push(value.length)
    if (edit.backward) start = [...boundaries].reverse().find((index) => index < start) ?? start
    else end = boundaries.find((index) => index > end) ?? end
  }
  const point = (items: Text[], index: number): [Node, number] => {
    for (const node of items) {
      if (index <= node.length) return [node, index]
      index -= node.length
    }
    const node = document.createTextNode("")
    heading.append(node)
    return [node, 0]
  }
  const range = document.createRange()
  range.setStart(...point(texts, start))
  range.setEnd(...point(texts, end))
  range.deleteContents()
  const insertion = "insert" in edit ? edit.insert : ""
  if (insertion && !value) {
    const marker = heading.querySelector<HTMLElement>("[data-callout-marker]")
    if (marker && !/[ \t]$/.test(marker.textContent || "")) marker.append(document.createTextNode(" "))
  }
  if (insertion) range.insertNode(document.createTextNode(insertion))
  range.setStart(...point(nodes(), start + insertion.length))
  range.collapse(true)
  editable.focus({ preventScroll: true })
  selection.removeAllRanges()
  selection.addRange(range)
  heading.classList.add("vessel-callout-editing")
  return true
}


export function deleteCalloutTitle(heading: HTMLElement, backward: boolean): boolean {
  return editCalloutTitle(heading, { backward })
}

export function insertCalloutTitle(heading: HTMLElement, text: string): boolean {
  return editCalloutTitle(heading, { insert: text.replace(/[\r\n]+/g, " ") })
}
