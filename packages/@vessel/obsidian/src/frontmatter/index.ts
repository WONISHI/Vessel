import { parseBaseYaml } from "#vessel-obsidian/bases/yaml"

export interface FrontmatterProperty {
  key: string
  value: string
}
export interface FrontmatterDocument {
  raw: string
  body: string
  properties: FrontmatterProperty[]
}
/** 解析文档起始的扁平 YAML 属性；复杂 YAML 保留原文，不做有损转换。 */
function parseFlatFrontmatter(source: string): FrontmatterDocument | null {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
  if (!match) return null
  const properties: FrontmatterProperty[] = []
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue
    const field = /^([^\s:#][^:]*):(?:[ \t]+(.*))?$/.exec(line)
    if (!field) return null
    let value = field[2] || ""
    if (/^[>|[{]/.test(value) && !value.startsWith("[[")) return null
    if (value.startsWith('"')) {
      try {
        const parsed: unknown = JSON.parse(value)
        if (typeof parsed !== "string") return null
        value = parsed
      } catch {
        return null
      }
    } else if (value.startsWith("'")) {
      if (!value.endsWith("'")) return null
      value = value.slice(1, -1).replace(/''/g, "'")
    } else value = value.replace(/\s+#.*$/, "")
    properties.push({ key: field[1].trim(), value })
  }
  if (!properties.length) return null
  return { raw: match[0], body: source.slice(match[0].length), properties }
}

/** Parses YAML lists and mappings for display while retaining the original bytes for editing round trips. */
export function parseFrontmatter(source: string): FrontmatterDocument | null {
  const flat = parseFlatFrontmatter(source)
  if (flat) return flat
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
  if (!match) return null
  try {
    const value = parseBaseYaml(match[1])
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const properties = Object.entries(value).map(([key, entry]) => ({ key, value: formatProperty(entry) }))
    return properties.length ? { raw: match[0], body: source.slice(match[0].length), properties } : null
  } catch {
    return null
  }
}

/** Formats nested property values for reading without flattening or rewriting their source YAML. */
function formatProperty(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.map(formatProperty).join("\n")
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)
}
