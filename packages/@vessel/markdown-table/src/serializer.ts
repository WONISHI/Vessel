import type { MarkdownTableData } from "./types.js"

export function serializeMarkdownTable(data: MarkdownTableData): string {
  return JSON.stringify(data, null, 2)
}
