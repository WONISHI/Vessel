import { useEffect, useRef, useState } from "react"
import { VirtualTree, type VirtualTreeRow } from "@/components/ui/tree"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "../../hooks/useWorkspace"
import type { WorkspaceNode } from "../../types/workspace"
import FileTreeItem from "./file-tree-item"

interface DirectoryState {
  nodes?: WorkspaceNode[]
  error?: string
}
export default function WorkspaceTree({ viewport, recent = false }: { viewport: HTMLElement | null; recent?: boolean }) {
  const { workspace, openFiles, activeFilePath, openFile, expandedFolders, setFolderExpanded } = useWorkspace()
  const [directories, setDirectories] = useState<Record<string, DirectoryState>>({})
  const pending = useRef(new Map<string, Promise<void>>())
  const mounted = useRef(true)
  const load = (path: string) => {
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
      void load(workspace.path)
      expandedFolders.forEach((path) => {
        void load(path)
      })
    }
    return () => {
      mounted.current = false
    }
    // Cache lifetime is scoped by the workspace/activity key in the parent.
  }, [])
  const rows: VirtualTreeRow<WorkspaceNode>[] = []
  const flatten = (nodes: WorkspaceNode[], depth = 0) =>
    nodes.forEach((node) => {
      const folder = node.type === "directory"
      const expanded = folder && expandedFolders.includes(node.path)
      rows.push({ id: node.path, item: node, depth, expanded: folder ? expanded : undefined })
      if (expanded) flatten(directories[node.path]?.nodes ?? [], depth + 1)
    })
  const root = directories[workspace.path]
  flatten(recent ? openFiles : (root?.nodes ?? []))
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
        onClick={() => void load(workspace.path)}
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
              openFile(node)
              return
            }
            if (directories[node.path]?.error) {
              void load(node.path)
              return
            }
            setFolderExpanded(node.path, !expanded)
            if (!expanded && !directories[node.path]?.nodes) void load(node.path)
          }}
        />
      )}
    />
  )
}
