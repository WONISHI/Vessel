/** Constructs standard Markdown link syntax [text](url). */
export function buildMarkdownLink(text: string, url: string): string {
  return `[${text}](${url})`
}

/** Normalizes user input into a valid web or relative URL. */
export function normalizeLinkUrl(input: string): string {
  let trimmed = input.trim()
  if (!trimmed) return ""
  // Clean duplicate protocols like https://https:// or https://http://
  trimmed = trimmed.replace(/^(?:https?:\/\/)+(https?:\/\/)/i, "$1")
  // If already prefixed with protocol, anchor or path, keep as is
  if (/^(?:https?:\/\/|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(trimmed)) {
    return trimmed
  }
  // If user entered www.xxx or domain.com, prepend https://
  return `https://${trimmed}`
}

/** Parses single Markdown link if valid. */
export function parseMarkdownLink(source: string): { text: string; url: string } | null {
  const match = source.match(/^\[([\s\S]*?)\]\(([\s\S]*?)\)$/)
  if (!match) return null
  return {
    text: match[1],
    url: match[2]
  }
}

export interface MarkdownLinkSpan {
  text: string
  url: string
  index: number
  length: number
  raw: string
}

/** Finds all markdown links in a source string. */
export function findAllMarkdownLinks(source: string): MarkdownLinkSpan[] {
  const regex = /\[([^\[\]]*)\]\(([^()]*)\)/g
  const links: MarkdownLinkSpan[] = []
  for (const match of source.matchAll(regex)) {
    if (match.index !== undefined) {
      links.push({
        text: match[1],
        url: match[2],
        index: match.index,
        length: match[0].length,
        raw: match[0]
      })
    }
  }
  return links
}
