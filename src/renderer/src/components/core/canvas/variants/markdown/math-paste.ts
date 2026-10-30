/** Normalize common copied LaTeX delimiters without touching code samples. */
export function normalizeClipboardMath(text: string): string {
  return text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g).map((part, index) => index % 2 ? part : part
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, source: string) => `\n\n$$\n${source.trim()}\n$$\n\n`)
    .replace(/\\\(([^\n]*?)\\\)/g, (_match, source: string) => `$${source.trim()}$`)).join("")
}

/** Recover source formulas before HTML conversion flattens KaTeX's visual and accessibility layers. */
export function clipboardMathMarkdown(html: string, htmlToMarkdown: (html: string) => string): string | null {
  if (!html) return null
  const document = new DOMParser().parseFromString(html, "text/html")
  const formulas: string[] = []
  const prefix = `VESSELMATH${crypto.randomUUID().replaceAll("-", "")}TOKEN`
  const candidates = document.querySelectorAll('.katex-display, .katex, math, mjx-container, [data-math], [data-latex], [data-tex], .math-inline, .math-display, script[type^="math/tex"]')
  for (const node of candidates) {
    if (!document.body.contains(node) || node.closest("pre, code")) continue
    const source = node.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="application/x-latex"]')?.textContent
      ?? node.getAttribute("data-math")
      ?? node.getAttribute("data-latex")
      ?? node.getAttribute("data-tex")
      ?? (node.matches('script[type^="math/tex"]') ? node.textContent : null)
    if (!source?.trim()) continue
    const display = node.closest('.katex-display, .math-display, mjx-container[display="true"]')
      ?? (node.getAttribute("display") === "block" || node.getAttribute("type")?.includes("mode=display") ? node : null)
    // Replace the complete formula wrapper, including accessibility and visual siblings.
    const target = display ?? node.closest('[data-latex], [data-tex], [data-math], .math-inline') ?? node
    const token = `${prefix}${formulas.length}END`
    formulas.push(display ? `\n\n$$\n${source.trim()}\n$$\n\n` : `$${source.trim()}$`)
    target.replaceWith(document.createTextNode(token))
  }
  if (!formulas.length) return null
  let markdown = htmlToMarkdown(document.body.innerHTML)
  formulas.forEach((formula, index) => { markdown = markdown.replaceAll(`${prefix}${index}END`, () => formula) })
  return markdown
}
