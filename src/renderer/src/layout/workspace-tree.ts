import type { WorkspaceNode } from "./types/workspace"

/** 将扫描接口的扁平路径还原为目录树，同时兼容已有嵌套节点。 */
export function buildWorkspaceTree(files: WorkspaceNode[], rootPath: string): WorkspaceNode[] {
  if (files.some((file) => file.children)) return files
  const root = rootPath.replace(/\\/g, "/").replace(/\/$/, "")
  const tree: WorkspaceNode[] = []
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
  const sort = (nodes: WorkspaceNode[]) => {
    nodes.sort((a, b) => Number(Boolean(b.children)) - Number(Boolean(a.children)) || a.name.localeCompare(b.name, "zh-CN", { numeric: true }))
    nodes.forEach((node) => {
      if (node.children) sort(node.children)
    })
  }
  sort(tree)
  return tree
}
