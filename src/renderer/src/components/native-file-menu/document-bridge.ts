/** Mounted Markdown editors expose current drafts for native save/export commands. */
export const markdownDocuments = new Map<string, { content(): string; html(): string }>()

export function printableMarkdown(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  // Read-only Vditor previews have no `vessel-direct-code` class. Normalize both
  // variants before cleaning markers, so preview copy buttons/SVGs cannot be printed.
  const originals = root.querySelectorAll('[data-type="code-block"], .vessel-direct-code')
  clone.querySelectorAll('[data-type="code-block"], .vessel-direct-code').forEach((block, index) => {
    const original = originals[index]
    const source = original?.querySelector('pre.vditor-ir__marker code') || original?.querySelector('pre.vditor-ir__preview code')
    if (!source) return
    const language = Array.from(source.classList).find((name) => name.startsWith("language-"))?.slice(9).toLowerCase() || "text"
    if (original.matches('.vessel-image-block, .vessel-table-block') || ["vessel-obsidian-image", "markdown-table", "mermaid", "steps", "timeline"].includes(language)) return
    const pre = document.createElement("pre")
    const code = document.createElement("code")
    code.textContent = source.textContent || ""
    pre.append(code)
    block.replaceWith(pre)
  })
  // Keep wikilink labels and task states before removing interactive controls.
  clone.querySelectorAll("button[data-wiki-target]").forEach((node) => node.replaceWith(document.createTextNode(node.textContent || "")))
  const checkboxes = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
  clone.querySelectorAll('input[type="checkbox"]').forEach((node, index) => node.replaceWith(document.createTextNode(checkboxes[index]?.checked ? "☑ " : "☐ ")))
  clone.querySelectorAll(".vessel-table-toolbar, .vessel-image-link-bar, .vessel-code-toolbar").forEach((node) => node.remove())
  // Export rendered content, without Vditor source fences and editing controls.
  clone.querySelectorAll('.vditor-ir__marker, .vessel-html-marker, .vessel-image-block > :not(.vditor-ir__preview), .vessel-table-block > :not(.vditor-ir__preview), [data-highlight-marker], [data-type="code-block-open-marker"], [data-type="code-block-close-marker"], .vditor-copy, button, input, textarea, script, iframe').forEach((node) => node.remove())
  clone.querySelectorAll<HTMLElement>('[contenteditable]').forEach((node) => node.removeAttribute('contenteditable'))
  return `<!doctype html><html><head><meta charset="UTF-8"><title>Vessel 文档</title><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'"><style>@page{size:A4;margin:18mm}body{font:14px/1.65 sans-serif;color:#222;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px}pre{white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.9em;line-height:1.5;overflow-wrap:anywhere;tab-size:4;break-inside:auto;orphans:3;widows:3}pre code{display:block;font:inherit;white-space:pre-wrap;tab-size:inherit}a,[data-vessel-link]{color:#15803d;text-decoration:underline}[data-vessel-highlight]{background:#fef08a}h1,h2,h3{break-after:avoid}img,tr{break-inside:avoid}</style></head><body>${clone.innerHTML}</body></html>`
}
