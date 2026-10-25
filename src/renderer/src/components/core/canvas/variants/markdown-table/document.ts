import { generateCellId, parseMarkdownTable, serializeMarkdownTable } from "@vessel/markdown-table"

/** New files contain table JSON, without a Markdown code fence. */
export function createMarkdownTableDocument(name = "未命名.markdowntable") {
  return serializeMarkdownTable({
    version: 1,
    caption: name.replace(/\.markdowntable$/i, ""),
    columns: [{ align: "left" }, { align: "left" }, { align: "left" }],
    rows: [{ isHeader: true, cells: Array.from({ length: 3 }, () => ({ id: generateCellId(), text: "" })) }, { cells: Array.from({ length: 3 }, () => ({ id: generateCellId(), text: "" })) }],
    merges: []
  })
}

/** Reject malformed documents instead of displaying and saving fallback sample data. */
export function parseMarkdownTableDocument(source: string) {
  const raw = JSON.parse(source)
  if (!raw || !Array.isArray(raw.columns) || !Array.isArray(raw.rows) || !raw.rows.every((row: unknown) => row && typeof row === "object" && Array.isArray((row as { cells?: unknown }).cells))) throw new Error("不是有效的高级表格 JSON 文件")
  return parseMarkdownTable(source)
}
