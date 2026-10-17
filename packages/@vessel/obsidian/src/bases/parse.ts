import { parseBaseNoteProperties } from "#vessel-obsidian/bases/note-properties"
import { parseBaseYaml } from "#vessel-obsidian/bases/yaml"
export { parseBaseYaml } from "#vessel-obsidian/bases/yaml"
import type { BaseDocument, BaseFile, BaseFilter, BaseView } from "#vessel-obsidian/bases/types"

/** Narrows YAML objects while rejecting arrays and null. */
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Validates recursive AND/OR/NOT filters before evaluating workspace files. */
function validateFilter(value: unknown, depth = 0): asserts value is BaseFilter {
  if (depth > 32) throw new Error("Base 筛选嵌套过深")
  if (typeof value === "string") return
  if (!record(value) || Object.keys(value).length !== 1) throw new Error("Base filters 必须是表达式或 and/or/not 条件")
  const [key, conditions] = Object.entries(value)[0]
  if (!["and", "or", "not"].includes(key) || !Array.isArray(conditions)) throw new Error("Base 筛选条件格式错误")
  conditions.forEach((condition) => validateFilter(condition, depth + 1))
}

/** Reads an Obsidian .base configuration, preserving supported table-view settings. */
export function parseBase(source: string): BaseDocument {
  const input = parseBaseYaml(source)
  if (!record(input)) throw new Error("Base 文件必须是 YAML 对象")
  if (!Array.isArray(input.views) || !input.views.length) throw new Error("Base 文件没有 views 视图")
  if (input.filters !== undefined) validateFilter(input.filters)
  const formulas: Record<string, string> = Object.create(null)
  if (input.formulas !== undefined && !record(input.formulas)) throw new Error("Base formulas 格式错误")
  for (const [key, value] of Object.entries(input.formulas || {})) {
    if (typeof value !== "string") throw new Error(`公式 ${key} 必须是字符串`)
    formulas[key] = value
  }
  const properties: BaseDocument["properties"] = Object.create(null)
  if (input.properties !== undefined && !record(input.properties)) throw new Error("Base properties 格式错误")
  for (const [key, value] of Object.entries(input.properties || {})) {
    if (!record(value) || (value.displayName !== undefined && typeof value.displayName !== "string")) throw new Error(`属性 ${key} 的 displayName 格式错误`)
    properties[key] = { displayName: value.displayName as string | undefined }
  }
  const warnings: string[] = []
  if (input.summaries) warnings.push("暂不支持自定义汇总公式")
  const views = input.views.map((value, index): BaseView => {
    if (!record(value) || typeof value.type !== "string") throw new Error(`视图 ${index + 1} 缺少 type`)
    if (value.filters !== undefined) validateFilter(value.filters)
    if (value.order !== undefined && (!Array.isArray(value.order) || value.order.some((key) => typeof key !== "string"))) throw new Error("视图 order 必须是列名数组")
    if (value.limit !== undefined && (!Number.isInteger(value.limit) || Number(value.limit) < 0)) throw new Error("视图 limit 必须是非负整数")
    if (value.sort !== undefined && (!Array.isArray(value.sort) || value.sort.some((sort) => !record(sort) || typeof sort.property !== "string" || !["ASC", "DESC"].includes(String(sort.direction).toUpperCase())))) throw new Error("视图 sort 格式错误")
    if (value.groupBy !== undefined && (!record(value.groupBy) || typeof value.groupBy.property !== "string" || (value.groupBy.direction !== undefined && !["ASC", "DESC"].includes(String(value.groupBy.direction).toUpperCase())))) throw new Error("视图 groupBy 格式错误")
    if (value.summaries) warnings.push(`视图 ${value.name || index + 1} 的列汇总暂不支持`)
    if (value.groupOrder) warnings.push(`视图 ${value.name || index + 1} 的 groupOrder 暂不支持`)
    return {
      type: value.type,
      name: typeof value.name === "string" ? value.name : `视图 ${index + 1}`,
      filters: value.filters as BaseFilter | undefined,
      order: value.order as string[] | undefined,
      limit: value.limit as number | undefined,
      sort: (value.sort as BaseView["sort"])?.map((sort) => ({ ...sort, direction: sort.direction.toUpperCase() as "ASC" | "DESC" })),
      groupBy: value.groupBy ? { property: (value.groupBy as { property: string }).property, direction: String((value.groupBy as { direction?: string }).direction || "ASC").toUpperCase() as "ASC" | "DESC" } : undefined
    }
  })
  return { filters: input.filters as BaseFilter | undefined, formulas, properties, views, warnings }
}

/** Creates a queryable file from vault-relative metadata and optional Markdown contents. */
export function createBaseFile(path: string, source = "", metadata: { size?: number; ctime?: number; mtime?: number } = {}): BaseFile {
  path = path.replace(/\\/g, "/")
  const filename = path.split("/").pop() || path
  const dot = filename.lastIndexOf(".")
  const frontmatter = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
  const properties = frontmatter ? parseBaseNoteProperties(frontmatter[1]) : {}
  const body = frontmatter ? source.slice(frontmatter[0].length) : source
  const rawTags = properties.tags ?? properties.tag ?? []
  const tags = [...(Array.isArray(rawTags) ? rawTags : [rawTags]).map(String), ...Array.from(body.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu), (match) => match[1])].map((tag) => tag.replace(/^#/, ""))
  const links = Array.from(source.matchAll(/!?\[\[([^\]|#]+)(?:[^\]]*)\]\]/g), (match) => match[1])
  return {
    path,
    properties,
    file: {
      name: dot > 0 ? filename.slice(0, dot) : filename,
      path,
      folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
      ext: dot > 0 ? filename.slice(dot + 1).toLowerCase() : "",
      size: metadata.size ?? 0,
      ctime: metadata.ctime ?? 0,
      mtime: metadata.mtime ?? 0,
      tags: [...new Set(tags)],
      links,
      properties
    }
  }
}
