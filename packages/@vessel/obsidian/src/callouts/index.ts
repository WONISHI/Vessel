export const calloutTypes = ["note", "abstract", "info", "todo", "tip", "success", "question", "warning", "failure", "danger", "bug", "example", "quote"] as const
export type CalloutType = typeof calloutTypes[number]
const aliases: Record<string, CalloutType> = { summary: "abstract", tldr: "abstract", hint: "tip", important: "tip", check: "success", done: "success", help: "question", faq: "question", caution: "warning", attention: "warning", fail: "failure", missing: "failure", error: "danger", cite: "quote" }
export interface CalloutHeader {
  type: CalloutType
  /** Preserve unknown type names for custom callouts; their default appearance is note. */
  name: string
  title: string
  foldable: boolean
  expanded: boolean
}
/** Parse a blockquote's first content line, without consuming its Markdown body. */
export function parseCalloutHeader(line: string): CalloutHeader | null {
  const match = /^\s*\[!([\w-]+)\]([+-])?(?:[ \t]+([^\r\n]*))?[ \t]*$/.exec(line)
  if (!match) return null
  const name = match[1].toLowerCase()
  const type = aliases[name] ?? (calloutTypes.includes(name as CalloutType) ? name as CalloutType : "note")
  let title = match[3]?.trim() ?? ""
  // Older imported notes place a decorative pencil and fold flag in the title.
  title = title.replace(/^✏\uFE0F?\s*/, "")
  let fold = match[2]
  if (!fold) {
    const legacy = /^([+-])[ \t]*/.exec(title)
    if (legacy) { fold = legacy[1]; title = title.slice(legacy[0].length).trim() }
  }
  return { type, name, title, foldable: Boolean(fold), expanded: fold !== "-" }
}
