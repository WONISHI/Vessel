import type { WorkspaceNode } from "../../types/workspace"

export function countFiles(nodes: WorkspaceNode[]): number {
  return nodes.reduce((count, node) => count + (node.children ? countFiles(node.children) : 1), 0)
}
export function fileAppearance(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? ""
  if (["md", "markdown"].includes(extension)) return { label: "MD", color: "text-violet-500", badge: "bg-violet-100 text-violet-600" }
  if (["ts", "tsx"].includes(extension)) return { label: extension.toUpperCase(), color: "text-blue-500", badge: "bg-blue-100 text-blue-600" }
  if (["js", "jsx", "json"].includes(extension)) return { label: extension.toUpperCase(), color: "text-amber-500", badge: "bg-amber-100 text-amber-600" }
  if (extension === "vue") return { label: "Vue", color: "text-green-600", badge: "bg-green-100 text-green-600" }
  return { label: extension.toUpperCase(), color: "text-stone-400", badge: "bg-stone-100 text-stone-500" }
}
