import type { FileTreeNode } from "./types"

/**
 * 将文件扫描结果转换成目录树，供文件浏览器按层级展示。
 * @param files 文件路径列表或已有的嵌套节点；不修改传入数组。
 * @param rootPath 工作区根路径，支持 Windows 和 POSIX 分隔符。
 * @returns 目录优先排序的树；已嵌套的数据原样返回。
 */
export function createFileTreeFromPaths(files: FileTreeNode[], rootPath: string): FileTreeNode[] {
  if (files.some((file) => file.children)) return files
  const root = rootPath.replace(/\\/g, "/").replace(/\/$/, "")
  const tree: FileTreeNode[] = []
  for (const file of files) {
    const normalized = file.path.replace(/\\/g, "/")
    const relative = normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : file.name
    const parts = relative.split("/").filter(Boolean)
    let siblings = tree
    let path = root
    for (const part of parts.slice(0, -1)) {
      path += `/${part}`
      let folder = siblings.find((node) => node.path === path && node.children)
      if (!folder) {
        folder = { name: part, path, type: "directory", children: [] }
        siblings.push(folder)
      }
      siblings = folder.children!
    }
    siblings.push({ ...file, type: "file" })
  }
  const sort = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => Number(Boolean(b.children)) - Number(Boolean(a.children)) || a.name.localeCompare(b.name, "zh-CN", { numeric: true }))
    nodes.forEach((node) => {
      if (node.children) sort(node.children)
    })
  }
  sort(tree)
  return tree
}
