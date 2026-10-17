import { parseDocument } from "yaml"

/** Parses YAML without custom executable tags or unbounded alias expansion. */
export function parseBaseYaml(source: string): unknown {
  const document = parseDocument(source, { uniqueKeys: true })
  if (document.errors.length) throw new Error(`Base YAML 错误：${document.errors[0].message}`)
  const result: unknown = document.toJS({ maxAliasCount: 50 })
  const ancestors = new Set<object>()
  let visited = 0

  /** Rejects cyclic or excessively nested YAML values before they reach filtering or IPC. */
  const validate = (value: unknown, depth = 0): void => {
    if (++visited > 50000 || depth > 64) throw new Error("YAML 数据过于复杂")
    if (!value || typeof value !== "object") return
    if (ancestors.has(value)) throw new Error("YAML 不支持循环引用")
    ancestors.add(value)
    for (const entry of Object.values(value)) validate(entry, depth + 1)
    ancestors.delete(value)
  }
  validate(result)
  return result
}
