const supported = new Set(["font", "span", "u", "b", "strong", "i", "em", "s", "del", "mark", "small", "sub", "sup"])
/** 将行内 HTML 标记之间的内容加上白名单样式；保留原始标记用于 Markdown 序列化。 */
export function decorateInlineHTML(root: HTMLElement) {
  const stacks = new Map<Node, { tag: string; node: HTMLElement; source: string }[]>()
  for (const marker of root.querySelectorAll<HTMLElement>('[data-type="html-inline"]')) {
    const source = marker.querySelector("code")?.textContent?.trim() || ""
    const match = source.match(/^<(\/)?([a-z]+)\b[^>]*>$/i)
    if (!match || !supported.has(match[2].toLowerCase()) || !marker.parentNode) continue
    const tag = match[2].toLowerCase()
    const stack = stacks.get(marker.parentNode) || []
    stacks.set(marker.parentNode, stack)
    if (!match[1]) { stack.push({ tag, node: marker, source }); continue }
    const opening = stack.pop()
    if (!opening || opening.tag !== tag) continue
    opening.node.classList.add("vessel-html-marker")
    marker.classList.add("vessel-html-marker")
    if (opening.node.nextElementSibling?.hasAttribute("data-vessel-inline-html")) continue
    const template = document.createElement("template")
    template.innerHTML = opening.source
    const original = template.content.firstElementChild as HTMLElement | null
    const preview = document.createElement("span")
    preview.dataset.vesselInlineHtml = "true"
    for (const property of ["color", "backgroundColor", "fontWeight", "fontStyle", "textDecoration"] as const) preview.style[property] = original?.style[property] || ""
    if (tag === "font") preview.style.color = original?.getAttribute("color") || ""
    if (["b", "strong"].includes(tag)) preview.style.fontWeight = "bold"
    if (["i", "em"].includes(tag)) preview.style.fontStyle = "italic"
    if (tag === "u") preview.style.textDecoration = "underline"
    if (["s", "del"].includes(tag)) preview.style.textDecoration = "line-through"
    if (tag === "mark") preview.style.backgroundColor ||= "#fef08a"
    if (["small", "sub", "sup"].includes(tag)) preview.style.fontSize = "0.8em"
    if (["sub", "sup"].includes(tag)) preview.style.verticalAlign = tag === "sub" ? "sub" : "super"
    const range = document.createRange()
    range.setStartAfter(opening.node)
    range.setEndBefore(marker)
    preview.append(range.extractContents())
    range.insertNode(preview)
  }
}
