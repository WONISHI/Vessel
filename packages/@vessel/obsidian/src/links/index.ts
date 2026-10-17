import { parseWikiLinks } from "#vessel-obsidian/wikilinks"

export interface ObsidianTextPart {
  kind: "text" | "wiki" | "url"
  text: string
  target?: string
}

/** Splits property text into safe display segments, preserving wiki aliases and surrounding text. */
export function parseObsidianLinks(source: string): ObsidianTextPart[] {
  const parts: ObsidianTextPart[] = []
  const wikiLinks = parseWikiLinks(source)
  let offset = 0

  /** Recognizes HTTP(S) URLs without turning markup or unsafe protocols into executable links. */
  const appendText = (text: string) => {
    let end = 0
    for (const match of text.matchAll(/https?:\/\/[^\s<>"'\[\]，。；！、]+/gi)) {
      const url = match[0].replace(/[.,;!，。；！、]+$/, "")
      try {
        const parsed = new URL(url)
        if (!parsed.hostname) continue
      } catch {
        continue
      }
      if (match.index > end) parts.push({ kind: "text", text: text.slice(end, match.index) })
      parts.push({ kind: "url", text: url, target: url })
      end = match.index + url.length
    }
    if (end < text.length) parts.push({ kind: "text", text: text.slice(end) })
  }

  for (const link of wikiLinks) {
    appendText(source.slice(offset, link.index))
    parts.push({ kind: "wiki", text: link.label, target: link.target })
    offset = link.index + link.raw.length
  }
  appendText(source.slice(offset))
  return parts
}
