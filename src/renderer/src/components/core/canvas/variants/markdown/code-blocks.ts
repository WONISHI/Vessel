const darkPalette: Record<string, string> = { keyword: "#f47067", string: "#96d0ff", number: "#6cb6ff", title: "#dcbdfb", comment: "#768390", variable: "#6cb6ff", built_in: "#6cb6ff" }
let nextHighlightId = 0
const layers = new WeakMap<HTMLElement, { prefix: string; style: HTMLStyleElement }>()
const palette: Record<string, string> = { keyword: "#a626a4", string: "#50a14f", number: "#986801", title: "#4078f2", comment: "#a0a1a7", variable: "#986801", built_in: "#c18401" }

/** Clears code highlights. */
export function clearCodeHighlights(root: HTMLElement) {
  const layer = layers.get(root)
  if (!layer) return
  for (const kind of Object.keys(palette)) CSS.highlights?.delete(`${layer.prefix}-${kind}`)
  layer.style.remove()
  layers.delete(root)
}

/** Performs the highlight code operation. */
function highlightCode(root: HTMLElement) {
  if (!("highlights" in CSS) || typeof Highlight === "undefined") return
  let layer = layers.get(root)
  if (!layer) {
    const prefix = `vessel-code-${nextHighlightId++}`
    const style = document.createElement("style")
    style.textContent = Object.entries(palette)
      .map(([kind, color]) => `::highlight(${prefix}-${kind}){color:${color}} html.dark ::highlight(${prefix}-${kind}){color:${darkPalette[kind]}}`)
      .join("")
    document.head.append(style)
    layer = { prefix, style }
    layers.set(root, layer)
  }
  const ranges: Record<string, Range[]> = {}
  root.querySelectorAll(".vessel-direct-code").forEach((block) => {
    const source = block.querySelector("pre.vditor-ir__marker code")
    const preview = block.querySelector("pre.vditor-ir__preview code")
    source?.normalize()
    if (!source?.firstChild || source.childNodes.length !== 1 || source.firstChild.nodeType !== Node.TEXT_NODE || source.textContent !== preview?.textContent) return
    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT)
    let offset = 0
    let node: Node | null
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length || 0
      const token = node.parentElement?.closest('[class*="hljs-"]')
      const kind = Object.keys(palette).find((key) => token?.classList.contains(`hljs-${key}`))
      if (kind && length) {
        const range = document.createRange()
        range.setStart(source.firstChild, offset)
        range.setEnd(source.firstChild, offset + length)
        ;(ranges[kind] ||= []).push(range)
      }
      offset += length
    }
  })
  for (const kind of Object.keys(palette)) CSS.highlights.set(`${layer.prefix}-${kind}`, new Highlight(...(ranges[kind] || [])))
}
/** Display the real editable code node as the card; never require a second source view. */
export function decorateCodeBlocks(root: HTMLElement, readOnly = false) {
  root.querySelectorAll<HTMLElement>('[data-type="code-block"]').forEach((block) => {
    if (block.classList.contains("vessel-image-block")) return
    const source = block.querySelector<HTMLElement>("pre.vditor-ir__marker")
    const preview = block.querySelector<HTMLElement>("pre.vditor-ir__preview")
    const pre = readOnly ? preview : source
    const code = pre?.querySelector<HTMLElement>("code")
    if (!pre || !code) return
    const language =
      Array.from(code.classList)
        .find((name) => name.startsWith("language-"))
        ?.slice(9) || "text"
    if (language === "vessel-obsidian-image") return
    if (["mermaid", "steps", "timeline"].includes(language.toLowerCase())) {
      // Diagram previews must remain under Vditor's native render/edit lifecycle.
      block.classList.remove("vessel-direct-code")
      for (const frame of block.querySelectorAll<HTMLElement>(".vessel-code-frame")) {
        frame.classList.remove("vessel-code-frame")
        delete frame.dataset.language
        frame.onmousedown = null
        frame.oncopy = null
      }
      return
    }
    block.classList.toggle("vessel-direct-code", !readOnly)
    pre.classList.add("vessel-code-frame")
    if (pre.dataset.language !== language) pre.dataset.language = language
    // Vditor/Lute requires a plain text node here; nested highlight spans corrupt serialization.
    if (!readOnly && code.children.length) {
      const text = code.textContent
      code.replaceChildren(document.createTextNode(text || ""))
    }
    if (!readOnly)
      pre.onmousedown = (event) => {
        if (event.clientY - pre.getBoundingClientRect().top > 40) return
        event.preventDefault()
        event.stopPropagation()
        root.dispatchEvent(new CustomEvent("vessel-code-language", { detail: block }))
      }
    if (readOnly) {
      pre.onmousedown = (event) => event.stopPropagation()
      pre.onmouseup = (event) => event.stopPropagation()
      pre.onclick = (event) => event.stopPropagation()
    }
    pre.oncopy = (event) => {
      const selection = window.getSelection()
      if (!selection || !code.contains(selection.anchorNode) || !code.contains(selection.focusNode)) return
      event.stopPropagation()
      event.preventDefault()
      event.clipboardData?.setData("text/plain", selection.toString())
    }
  })
  if (!readOnly) highlightCode(root)
}
