import { codeEditors } from "@/components/core/canvas/variants/code/search-bridge"
import type { ContentMatch } from "@vessel/type"
export type { ContentMatch }

/** Performs the highlight keyword in vditor operation. */
export function highlightKeywordInVditor(container: HTMLElement, keyword: string) {
  if (!keyword || !keyword.trim()) return
  const term = keyword.trim()
  const lower = term.toLowerCase()

  container.querySelectorAll(".vessel-search-highlight").forEach((el) => {
    const parent = el.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ""), el)
      parent.normalize()
    }
  })

  const blocks = Array.from(container.querySelectorAll<HTMLElement>("p, h1, h2, h3, h4, h5, h6, li, td, th, pre, blockquote, div")).filter((node) => {
    const hasBlockChild = Boolean(node.querySelector("p, li, pre, td, th, h1, h2, h3, h4, h5, h6"))
    return !hasBlockChild && (node.innerText || node.textContent || "").toLowerCase().includes(lower)
  })

  if (!blocks.length) return

  let firstMark: HTMLElement | null = null
  for (const block of blocks) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    let node = walker.nextNode()
    while (node) {
      if ((node.nodeValue || "").toLowerCase().includes(lower)) {
        textNodes.push(node as Text)
      }
      node = walker.nextNode()
    }

    for (const textNode of textNodes) {
      const text = textNode.nodeValue || ""
      const idx = text.toLowerCase().indexOf(lower)
      if (idx >= 0) {
        const before = text.slice(0, idx)
        const matchText = text.slice(idx, idx + term.length)
        const after = text.slice(idx + term.length)

        const mark = document.createElement("mark")
        mark.className = "vessel-search-highlight"
        mark.style.backgroundColor = "#bbf7d0"
        mark.style.color = "#064e3b"
        mark.style.borderRadius = "2px"
        mark.style.padding = "1px 2px"
        mark.style.fontWeight = "600"
        mark.textContent = matchText

        const frag = document.createDocumentFragment()
        if (before) frag.appendChild(document.createTextNode(before))
        frag.appendChild(mark)
        if (after) frag.appendChild(document.createTextNode(after))

        textNode.parentNode?.replaceChild(frag, textNode)
        if (!firstMark) firstMark = mark
      }
    }
  }

  const targetToScroll = firstMark || blocks[0]
  if (targetToScroll) {
    targetToScroll.scrollIntoView({ behavior: "smooth", block: "center" })
    const parentBlock = (firstMark ? firstMark.closest("td, th, p, h1, h2, h3, h4, h5, h6, li") : blocks[0]) as HTMLElement | null
    parentBlock?.animate?.([{ backgroundColor: "rgba(187, 247, 208, 0.45)" }, { backgroundColor: "rgba(187, 247, 208, 0.15)", offset: 0.8 }, { backgroundColor: "transparent" }], { duration: 2400 })
  }
}

/** Performs the reveal search hit operation. */
export function revealSearchHit(match: ContentMatch) {
  const range = match.ranges[0]
  const keyword = range ? match.text.slice(range.start, range.end) : match.text.trim()
  let tries = 0

  /** Performs the attempt operation. */
  const attempt = () => {
    const code = codeEditors.get(match.path)
    if (code) {
      const column = match.column
      code.revealLineInCenter(match.line)
      code.setPosition({ lineNumber: match.line, column })
      code.focus()
      return
    }
    const editor = [...document.querySelectorAll<HTMLElement>(".vditor-ir .vditor-reset")].find((node) => node.getClientRects().length)
    if (!editor) {
      if (++tries < 30) setTimeout(attempt, 100)
      return
    }
    highlightKeywordInVditor(editor, keyword)
  }
  setTimeout(attempt, 80)
}
