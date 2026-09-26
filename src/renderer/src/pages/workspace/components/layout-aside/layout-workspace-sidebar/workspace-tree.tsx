import { useEffect, useRef, useState } from "react"
import { VirtualTree, type VirtualTreeRow } from "@/components/ui/tree"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import type { WorkspaceNode } from "@/pages/workspace/types/workspace"
import FileTreeItem from "@/pages/workspace/components/layout-aside/layout-workspace-sidebar/file-tree-item"

interface DirectoryState {
  nodes?: WorkspaceNode[]
  error?: string
}
export default function WorkspaceTree({ viewport, recent = false }: { viewport: HTMLElement | null; recent?: boolean }) {
  const { workspace, openFiles, activeFilePath, openWorkspaceFile, expandedFolders, setDirectoryExpanded } = useWorkspace()
  const [directories, setDirectories] = useState<Record<string, DirectoryState>>({})
  const pending = useRef(new Map<string, Promise<void>>())
  const mounted = useRef(true)
  /** 按需读取直接子节点并缓存，合并同一路径的并发请求。
   * @param path 要展开的目录路径。
   * @returns 完成缓存更新的 Promise；失败信息保留用于重试。
   */
  const loadDirectoryChildren = (path: string) => {
    if (pending.current.has(path)) return pending.current.get(path)!
    const request = window.electronAPI
      .readWorkspaceDirectory(workspace.path, path)
      .then((nodes) => {
        if (mounted.current) setDirectories((state) => ({ ...state, [path]: { nodes } }))
      })
      .catch((error) => {
        if (mounted.current) setDirectories((state) => ({ ...state, [path]: { error: String(error) } }))
      })
      .finally(() => pending.current.delete(path))
    pending.current.set(path, request)
    return request
  }
  useEffect(() => {
    mounted.current = true
    if (!recent) {
      void loadDirectoryChildren(workspace.path)
      expandedFolders.forEach((path) => {
        void loadDirectoryChildren(path)
      })
    }
    return () => {
      mounted.current = false
    }
    // Cache lifetime is scoped by the workspace/activity key in the parent.
  }, [])
  const rows: VirtualTreeRow<WorkspaceNode>[] = []
  /** 仅展开已打开目录，将已加载节点转换成虚拟列表所需的可见行。 */
  const appendVisibleTreeRows = (nodes: WorkspaceNode[], depth = 0) =>
    nodes.forEach((node) => {
      const folder = node.type === "directory"
      const expanded = folder && expandedFolders.includes(node.path)
      rows.push({ id: node.path, item: node, depth, expanded: folder ? expanded : undefined })
      if (expanded) appendVisibleTreeRows(directories[node.path]?.nodes ?? [], depth + 1)
    })
  const root = directories[workspace.path]
  appendVisibleTreeRows(recent ? openFiles : (root?.nodes ?? []))
  if (!recent && !root)
    return (
      <p
        role="status"
        className="p-2 text-xs text-stone-400"
      >
        正在加载目录…
      </p>
    )
  if (!recent && root?.error)
    return (
      <Button
        variant="ghost"
        title={root.error}
        onClick={() => void loadDirectoryChildren(workspace.path)}
        className="w-full text-xs text-red-500"
      >
        目录加载失败，点击重试
      </Button>
    )
  if (!rows.length) return <p className="p-2 text-xs text-stone-400">暂无文件</p>
  return (
    <VirtualTree
      rows={rows}
      indent={16}
      viewport={viewport}
      selectedId={activeFilePath}
      renderRow={({ item: node, expanded }) => (
        <FileTreeItem
          node={node}
          selected={node.path === activeFilePath}
          expanded={Boolean(expanded)}
          loading={Boolean(expanded && !directories[node.path])}
          error={directories[node.path]?.error}
          onActivate={() => {
            if (node.type !== "directory") {
              openWorkspaceFile(node)
              return
            }
            if (directories[node.path]?.error) {
              void loadDirectoryChildren(node.path)
              return
            }
            setDirectoryExpanded(node.path, !expanded)
            if (!expanded && !directories[node.path]?.nodes) void loadDirectoryChildren(node.path)
          }}
        />
      )}
    />
  )
}
