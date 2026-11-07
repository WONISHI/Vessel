import { basename, extname } from "node:path"

const codeExtensions = new Set([
  ".txt", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts",
  ".json", ".html", ".htm", ".css", ".scss", ".less", ".vue", ".svelte",
  ".yaml", ".yml", ".xml", ".py", ".rs", ".go", ".java", ".c", ".cpp",
  ".h", ".sh", ".sql", ".env"
])

export function isCodePreviewFile(path: string) {
  return codeExtensions.has(extname(path).toLowerCase()) || basename(path).toLowerCase() === ".env"
}
