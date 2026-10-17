import { compileBaseExpression, type BaseExpressionContext } from "#vessel-obsidian/bases/expression"
import type { BaseDocument, BaseFile, BaseFilter, BaseQueryResult, BaseValue } from "#vessel-obsidian/bases/types"

/** Formats cell values without coercing missing properties to misleading strings. */
export function formatBaseValue(value: BaseValue | undefined): string {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.map(formatBaseValue).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/** Builds an AND/OR/NOT predicate once, rather than reparsing expressions for every row. */
function compileFilter(filter?: BaseFilter): (context: BaseExpressionContext) => boolean {
  if (filter === undefined || (typeof filter === "string" && !filter.trim())) return () => true
  if (typeof filter === "string") {
    const expression = compileBaseExpression(filter)
    return (context) => Boolean(expression(context))
  }
  const [operator, conditions] = Object.entries(filter)[0]
  const children = conditions!.map(compileFilter)
  if (operator === "and") return (context) => children.every((child) => child(context))
  if (operator === "or") return (context) => children.some((child) => child(context))
  return (context) => !children.some((child) => child(context))
}

/** Resolves configured columns, including literal property names containing spaces or non-Latin text. */
function columnValue(key: string, context: BaseExpressionContext): BaseValue {
  if (key.startsWith("formula.")) return context.formula(key.slice(8))
  if (key.startsWith("file.")) return Object.hasOwn(context.file.file, key.slice(5)) ? ((context.file.file as unknown as Record<string, BaseValue>)[key.slice(5)] ?? null) : null
  const name = key.startsWith("note.") ? key.slice(5) : key
  return Object.hasOwn(context.file.properties, name) ? context.file.properties[name] : null
}

/** Executes a read-only table view over vault files with global and per-view filters. */
export function queryBase(document: BaseDocument, files: BaseFile[], viewIndex = 0, base = files[0]): BaseQueryResult {
  const view = document.views[viewIndex]
  if (!view) throw new Error("Base 视图不存在")
  if (view.type !== "table") throw new Error(`暂不支持 ${view.type} 视图，请选择 table 表格视图`)
  const globalFilter = compileFilter(document.filters),
    viewFilter = compileFilter(view.filters)
  const formulas = new Map<string, ReturnType<typeof compileBaseExpression>>()
  const noteProperties = new Set(files.flatMap((file) => Object.keys(file.properties)))
  const warnings = new Set(document.warnings)
  const keys = view.order?.length ? view.order : ["file.name", ...new Set(files.flatMap((file) => Object.keys(file.properties)))].concat(Object.keys(document.formulas).map((key) => "formula." + key))
  const columns = [...new Set(keys)].map((key) => ({ key, label: document.properties[key]?.displayName || document.properties[key.replace(/^note\./, "")]?.displayName || (key === "file.name" ? "文件名" : key.replace(/^(note|formula)\./, "")) }))
  const resolved = new WeakMap<BaseExpressionContext, Map<string, BaseValue>>()

  /** Keeps stale formula columns/sorts visible as diagnostics instead of aborting the entire table. */
  const safeValue = (key: string, context: BaseExpressionContext): BaseValue => {
    let entries = resolved.get(context)
    if (!entries) {
      entries = new Map()
      resolved.set(context, entries)
    }
    if (entries.has(key)) return entries.get(key)!
    let value: BaseValue = null
    try {
      value = columnValue(key, context)
    } catch (error) {
      warnings.add(`${key}：${String(error)}`)
    }
    entries.set(key, value)
    return value
  }
  const rows: BaseQueryResult["rows"] = []
  const contexts = new Map<string, BaseExpressionContext>()
  for (const file of files) {
    const values = new Map<string, BaseValue>(),
      evaluating = new Set<string>()
    const context: BaseExpressionContext = {
      file,
      base: base || file,
      /** Evaluates formula dependencies once per file and rejects cycles. */
      formula(name) {
        if (values.has(name)) return values.get(name)!
        if (!Object.hasOwn(document.formulas, name)) {
          // Older Base configurations may retain the formula namespace after a field becomes a note property.
          // Resolve only properties present in the vault; genuinely missing formulas still report a diagnostic.
          if (noteProperties.has(name)) return Object.hasOwn(file.properties, name) ? file.properties[name] : null
          throw new Error(`公式 ${name} 不存在`)
        }
        const source = document.formulas[name]
        if (!source.trim()) return null
        let expression = formulas.get(name)
        if (!expression) {
          expression = compileBaseExpression(source)
          formulas.set(name, expression)
        }
        if (evaluating.has(name) || evaluating.size >= 32) throw new Error(`公式循环引用或嵌套过深：${name}`)
        evaluating.add(name)
        try {
          const value = expression(context)
          values.set(name, value)
          return value
        } finally {
          evaluating.delete(name)
        }
      }
    }
    if (!globalFilter(context) || !viewFilter(context)) continue
    const output: Record<string, BaseValue> = Object.create(null)
    for (const { key } of columns) {
      try {
        output[key] = safeValue(key, context)
      } catch (error) {
        warnings.add(String(error))
        output[key] = null
      }
    }
    rows.push({ path: file.path, values: output, ...(view.groupBy ? { group: safeValue(view.groupBy.property, context) } : {}) })
    contexts.set(file.path, context)
  }
  const sorts = [...(view.groupBy ? [{ property: view.groupBy.property, direction: view.groupBy.direction || "ASC" }] : []), ...(view.sort || [])]
  rows.sort((a, b) => {
    for (const sort of sorts) {
      const x = safeValue(sort.property, contexts.get(a.path)!),
        y = safeValue(sort.property, contexts.get(b.path)!)
      const difference = x === y ? 0 : x === null ? 1 : y === null ? -1 : typeof x === "number" && typeof y === "number" ? x - y : formatBaseValue(x).localeCompare(formatBaseValue(y), "zh-CN", { numeric: true })
      if (difference) return sort.direction === "DESC" ? -difference : difference
    }
    return a.path.localeCompare(b.path, "zh-CN", { numeric: true })
  })
  return { viewIndex, views: document.views.map(({ name, type }) => ({ name, type })), columns, rows: view.limit === undefined ? rows : rows.slice(0, view.limit), warnings: [...warnings] }
}
