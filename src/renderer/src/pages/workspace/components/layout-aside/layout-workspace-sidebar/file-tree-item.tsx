import { ChevronRight, File, Folder, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WorkspaceNode } from "@/pages/workspace/types/workspace"
import { getFilePresentation } from "@/pages/workspace/components/layout-aside/layout-workspace-sidebar/utils"

interface FileTreeItemProps {
  node: WorkspaceNode
  selected: boolean
  expanded: boolean
  loading?: boolean
  error?: string
  onActivate: () => void
}
/** 虚拟树中的单行；不递归挂载子节点。 */
export default function FileTreeItem({ node, selected, expanded, loading, error, onActivate }: FileTreeItemProps) {
  const folder = node.type === "directory"
  const appearance = getFilePresentation(node.name)
  return (
    <Button
      variant="ghost"
      title={error ? `${error}，点击重试` : node.path}
      onClick={onActivate}
      className={cn("h-8 w-full justify-start gap-2 rounded-md px-2 text-[11px] font-normal hover:bg-[#f0efed]", selected && "bg-emerald-50 text-green-700 hover:bg-emerald-50")}
    >
      <span
        aria-hidden
        className="flex size-3 shrink-0 items-center justify-center"
      >
        {folder && <ChevronRight className={cn("!size-3 text-stone-400 transition-transform", expanded && "rotate-90")} />}
      </span>
      {loading ? <LoaderCircle className="!size-3.5 animate-spin text-stone-400" /> : folder ? <Folder className="!size-3.5 text-amber-500" /> : <File className={cn("!size-3.5", appearance.color)} />}
      <span className={cn("min-w-0 flex-1 truncate text-left", folder && "font-semibold")}>{node.name}</span>
      {error ? <span className="text-[10px] text-red-500">重试</span> : !folder && appearance.label && <span className={cn("rounded px-1 py-0 text-[9px] leading-4 font-semibold", appearance.badge)}>{appearance.label}</span>}
    </Button>
  )
}
