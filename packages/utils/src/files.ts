import type { FileTreeNode } from "./types"

/**
 * 统计已加载树中的文件数量，供文件列表计数使用。
 * @param nodes 扁平文件列表或目录树；未加载目录不计作文件。
 * @returns 文件节点数量，不会触发文件系统读取。
 */
export function countFileNodes(nodes: readonly FileTreeNode[]): number {
  return nodes.reduce((count, node) => count + (node.children ? countFileNodes(node.children) : node.type === "directory" ? 0 : 1), 0)
}

/**
 * 提取路径末段的扩展名，供文件类型判断与标签展示使用。
 * @param path 文件名或路径，兼容斜杠与反斜杠。
 * @returns 不含点号的小写扩展名；无扩展名及点文件返回空字符串。
 */
export function getFileExtension(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? ""
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
}
