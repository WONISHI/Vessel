/** Performs the safe markdown url operation. */
export function safeMarkdownUrl(href: string): string | undefined {
  if (/^(https?:|mailto:|#)/i.test(href)) return href
  return undefined
}
