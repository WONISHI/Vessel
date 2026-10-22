/** Mounted Markdown editors expose current drafts for native save/export commands. */
export const markdownDocuments = new Map<string, { content(): string; html(): string }>()

export function printableMarkdown(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  // Export rendered content, without Vditor source fences and editing controls.
  clone.querySelectorAll('.vditor-ir__marker, .vessel-html-marker, .vessel-image-block > :not(.vditor-ir__preview), .vessel-table-block > :not(.vditor-ir__preview), [data-highlight-marker], button, input, script, iframe').forEach((node) => node.remove())
  clone.querySelectorAll('.vessel-direct-code > .vditor-ir__preview').forEach((node) => node.remove())
  // Direct code uses the marker as its visible code source; retain it when cloning below.
  const originals = root.querySelectorAll('.vessel-direct-code')
  clone.querySelectorAll('.vessel-direct-code').forEach((node, index) => {
    const code = originals[index]?.querySelector('pre.vditor-ir__marker code')
    const pre = document.createElement('pre')
    const content = document.createElement('code')
    content.textContent = code?.textContent ?? ''
    pre.append(content)
    node.replaceChildren(pre)
  })
  clone.querySelectorAll<HTMLElement>('[contenteditable]').forEach((node) => node.removeAttribute('contenteditable'))
  return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'"><style>@page{size:A4;margin:18mm}body{font:14px/1.65 sans-serif;color:#222;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px}pre{white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px}a,[data-vessel-link]{color:#15803d;text-decoration:underline}[data-vessel-highlight]{background:#fef08a}h1,h2,h3{break-after:avoid}img,pre,tr{break-inside:avoid}</style></head><body>${clone.innerHTML}</body></html>`
}
