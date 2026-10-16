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
export function parseFrontmatter(source: string): FrontmatterDocument | null {
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
