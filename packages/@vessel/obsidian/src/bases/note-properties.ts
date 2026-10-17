import { parseBaseYaml } from "#vessel-obsidian/bases/yaml"
import type { BaseValue } from "#vessel-obsidian/bases/types"

/** Reads static frontmatter while treating unexecuted Templater expressions as missing values. */
export function parseBaseNoteProperties(source: string): Record<string, BaseValue> {
  const marker = "__VESSEL_UNRESOLVED_TEMPLATE_7CF22__"
  const yaml = source.replace(/<%[\s\S]*?%>/g, (match: string, offset: number) => {
    const before = source.slice(source.lastIndexOf("\n", offset - 1) + 1, offset)
    const end = source.indexOf("\n", offset + match.length)
    const after = source.slice(offset + match.length, end < 0 ? undefined : end)
    // Standalone script blocks are not YAML fields. Keep their line breaks for diagnostics.
    return !before.trim() && !after.trim() ? match.replace(/[^\r\n]/g, "") : marker
  })
  const parsed = parseBaseYaml(yaml)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}

  /** Removes unresolved dynamic values without evaluating template code or fabricating note data. */
  const clean = (value: unknown): BaseValue => {
    if (typeof value === "string") return value.includes(marker) ? null : value
    if (value === null || typeof value === "number" || typeof value === "boolean") return value
    if (Array.isArray(value)) return value.map(clean)
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !key.includes(marker))
          .map(([key, entry]) => [key, clean(entry)])
      )
    return null
  }
  return clean(parsed) as Record<string, BaseValue>
}
