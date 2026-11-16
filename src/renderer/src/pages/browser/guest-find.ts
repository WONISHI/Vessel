export type GuestFindOptions = { matchCase?: boolean; next?: boolean; forward?: boolean }
export type GuestFindResult = { activeMatchOrdinal: number; matches: number }

/** Runs entirely inside the guest renderer. Native findInPage can deadlock the
 * Electron main process when the embedder also contains an iframe (#54508). */
function findInGuest(text: string, options: GuestFindOptions): GuestFindResult {
  type PageMatch = { range: Range; doc: Document }
  type Session = { text: string; matchCase: boolean; index: number; matches: PageMatch[]; dirty: boolean; observers: MutationObserver[]; docs: Document[] }
  const page = window as Window & { __vesselFindSession?: Session }
  let session = page.__vesselFindSession
  const clear = () => {
    if (!session) return
    session.observers.forEach((observer) => observer.disconnect())
    session.docs.forEach((doc) => {
      const win = doc.defaultView as (Window & typeof globalThis) | null
      win?.CSS.highlights.delete("vessel-find-all")
      win?.CSS.highlights.delete("vessel-find-active")
    })
    delete page.__vesselFindSession
  }
  if (!text) {
    clear()
    return { activeMatchOrdinal: 0, matches: 0 }
  }
  const matchCase = !!options.matchCase
  const fresh = !session || session.text !== text || session.matchCase !== matchCase || session.dirty
  if (fresh) {
    clear()
    session = { text, matchCase, index: -1, matches: [], dirty: false, observers: [], docs: [] }
    page.__vesselFindSession = session
    const current = session
    const collect = (doc: Document) => {
      const win = doc.defaultView as (Window & typeof globalThis) | null
      if (!win || !doc.body) return
      current.docs.push(doc)
      // CSS highlights preserve the page DOM, selection, input focus and handlers.
      let style = doc.getElementById("vessel-find-style")
      if (!style) {
        style = doc.createElement("style")
        style.id = "vessel-find-style"
        style.textContent = "::highlight(vessel-find-all){background:#fde68a;color:#1c1917}::highlight(vessel-find-active){background:#fb923c;color:#1c1917}"
        ;(doc.head || doc.documentElement).append(style)
      }
      const nodes: { node: Text; start: number; end: number }[] = []
      const chunks: string[] = []
      let length = 0
      let lastBlock: Element | undefined
      const blocks = new WeakMap<Element, Element>()
      const block = (element: Element): Element => {
        const cached = blocks.get(element)
        if (cached) return cached
        const display = win.getComputedStyle(element).display
        const value = element.parentElement && ["inline", "contents"].includes(display) ? block(element.parentElement) : element
        blocks.set(element, value)
        return value
      }
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            if (element.matches("script,style,noscript,template,input,textarea,select,[hidden]")) return NodeFilter.FILTER_REJECT
            if (element.tagName === "BR") { chunks.push("\n"); length++; return NodeFilter.FILTER_SKIP }
            const css = win.getComputedStyle(element)
            if (css.display === "none" || css.visibility === "hidden" || css.visibility === "collapse") return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_SKIP
          }
          return NodeFilter.FILTER_ACCEPT
        }
      })
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (!node.data || !node.parentElement) continue
        const parentBlock = block(node.parentElement)
        if (lastBlock && lastBlock !== parentBlock) { chunks.push("\n"); length++ }
        lastBlock = parentBlock
        nodes.push({ node, start: length, end: length + node.length })
        chunks.push(node.data)
        length += node.length
      }
      const content = chunks.join("")
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const pattern = new RegExp(escaped, matchCase ? "gu" : "giu")
      let startIndex = 0
      let endIndex = 0
      for (const match of content.matchAll(pattern)) {
        const start = match.index
        const end = start + match[0].length
        while (startIndex < nodes.length && nodes[startIndex].end <= start) startIndex++
        endIndex = Math.max(endIndex, startIndex)
        while (endIndex < nodes.length && nodes[endIndex].end < end) endIndex++
        const first = nodes[startIndex], last = nodes[endIndex]
        if (!first || !last || start < first.start || end < last.start) continue
        const range = doc.createRange()
        range.setStart(first.node, start - first.start)
        range.setEnd(last.node, end - last.start)
        current.matches.push({ range, doc })
      }
      const ranges = current.matches.filter((match) => match.doc === doc).map((match) => match.range)
      const highlight = new win.Highlight()
      ranges.forEach((range) => highlight.add(range))
      win.CSS.highlights.set("vessel-find-all", highlight)
      const observer = new win.MutationObserver(() => { current.dirty = true })
      observer.observe(doc.body, { childList: true, characterData: true, subtree: true, attributes: true })
      current.observers.push(observer)
      for (const frame of doc.querySelectorAll("iframe,frame")) {
        if (!frame.checkVisibility({ checkVisibilityCSS: true })) continue
        // Cross-origin frames are deliberately left to their own renderer.
        try { const child = (frame as HTMLIFrameElement).contentDocument; if (child) collect(child) } catch { /* Cross-origin frame. */ }
      }
    }
    collect(document)
  }
  if (!session || !session.matches.length) return { activeMatchOrdinal: 0, matches: 0 }
  const count = session.matches.length
  if (fresh) session.index = options.forward === false ? count - 1 : 0
  else if (options.next) session.index = (session.index + (options.forward === false ? -1 : 1) + count) % count
  session.docs.forEach((doc) => (doc.defaultView as (Window & typeof globalThis) | null)?.CSS.highlights.delete("vessel-find-active"))
  const active = session.matches[session.index]
  const win = active.doc.defaultView! as Window & typeof globalThis
  win.CSS.highlights.set("vessel-find-active", new win.Highlight(active.range))
  active.range.startContainer.parentElement?.scrollIntoView({ block: "center", inline: "nearest" })
  const rect = active.range.getBoundingClientRect()
  win.scrollBy(0, rect.top - win.innerHeight / 2)
  return { activeMatchOrdinal: session.index + 1, matches: count }
}

/** JSON encoding keeps arbitrary search text out of executable source. */
export function guestFindScript(text: string, options: GuestFindOptions = {}): string {
  return `(${findInGuest.toString()})(${JSON.stringify(text)},${JSON.stringify(options)})`
}
