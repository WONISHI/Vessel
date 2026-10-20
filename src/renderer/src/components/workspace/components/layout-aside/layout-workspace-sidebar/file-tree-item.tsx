import { Button } from "@/components/ui/button"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import type { WorkspaceNode } from "@/components/workspace/types/workspace"
import { cn } from "@/lib/utils"
import { ChevronRight, File, Folder, LoaderCircle } from "lucide-react"
import type { MouseEvent } from "react"

interface FileTreeItemProps {
  rootPath?: string
  node: WorkspaceNode
  selected: boolean
  expanded: boolean
  loading?: boolean
  error?: string
  onActivate: (event: MouseEvent<HTMLButtonElement>) => void
}
/** 虚拟树中的单行；不递归挂载子节点。 */
export default function FileTreeItem({ node, rootPath, selected, expanded, loading, error, onActivate }: FileTreeItemProps) {
  const root = rootPath?.replace(/\\/g, "/").replace(/\/$/, "")
  const path = node.path.replace(/\\/g, "/")
  const tooltipPath = root && (path === root || path.startsWith(`${root}/`)) ? `${root.split("/").pop()}${path.slice(root.length)}` : node.path
  const folder = node.type === "directory"
  const appearance = getFilePresentation(node.name)
  return (
    <Button
      data-workspace-tree-row
      data-selected={selected}
      variant="ghost"
      data-title={error ? `${error}，点击重试` : tooltipPath}
      onClick={onActivate}
      className={cn("h-8 w-full justify-start gap-2 rounded-md px-2 text-[11px] font-normal transition-none", selected ? "bg-emerald-50 text-green-700 font-medium hover:bg-emerald-50 hover:text-green-700 cursor-pointer shadow-none" : "text-stone-700 hover:bg-[#f0efed] hover:text-stone-900")}
    >
      <span
        aria-hidden
        className="flex size-3 shrink-0 items-center justify-center"
      >
        {folder && <ChevronRight className={cn("!size-3 text-stone-400 transition-transform", expanded && "rotate-90")} />}
      </span>
      {loading ? (
        <LoaderCircle className="!size-3.5 animate-spin text-stone-400" />
      ) : folder ? (
        <Folder
          data-tree-icon="folder"
          className="!size-3.5 text-amber-500"
        />
      ) : (
        <File
          data-tree-icon="file"
          className={cn("!size-3.5", appearance.color)}
        />
      )}
      <span
        data-tree-label
        className={cn("min-w-0 flex-1 truncate text-left", folder && "font-semibold")}
      >
        {node.name}
      </span>
      {error ? (
        <span className="text-[10px] text-red-500">重试</span>
      ) : (
        !folder &&
        appearance.label && (
          <span
            data-tree-badge={appearance.label?.toLowerCase()}
            className={cn("rounded px-1 py-0 text-[9px] leading-4 font-semibold", appearance.badge)}
          >
            {appearance.label}
          </span>
        )
      )}
    </Button>
  )
}
