import { useDirectoryTreeLayout } from "@/features/directory-tree/state"
import { fileTreeRowStyle } from "./tree-layout"
import { FileIconScope, useShowFileTypeBadges, useShowGitDecorations } from "@/features/file-icons/state"
import { gitDecorationStyle, useGitDecoration } from "@/features/git-decorations"
import { FileThemeIcon } from "@/features/file-icons"
import { Button } from "@/components/ui/button"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import type { WorkspaceNode } from "@/components/workspace/types/workspace"
import { cn } from "@/lib/utils"
import { ChevronRight, File, Folder, LoaderCircle } from "lucide-react"
import { useContext, type MouseEvent } from "react"
import { useDelayedLoading } from "@/hooks/use-delayed-loading"

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
  const showLoading = useDelayedLoading(Boolean(loading))
  const resourceSelection = useContext(FileIconScope) === "resources"
  const layout = useDirectoryTreeLayout()
  const root = rootPath?.replace(/\\/g, "/").replace(/\/$/, "")
  const path = node.path.replace(/\\/g, "/")
  const tooltipPath = root && (path === root || path.startsWith(`${root}/`)) ? `${root.split("/").pop()}${path.slice(root.length)}` : node.path
  const folder = node.type === "directory"
  const showTypeBadge = useShowFileTypeBadges()
  const appearance = getFilePresentation(node.name)
  const showGit = useShowGitDecorations()
  const gitCode = useGitDecoration(showGit ? rootPath : undefined, node.path, folder)
  const git = gitCode && gitDecorationStyle[gitCode]
  return (
    <Button
      data-workspace-tree-row
      data-selected={selected}
      variant="ghost"
      data-title={error ? `${error}，点击重试` : tooltipPath}
      data-title-side="right"
      style={fileTreeRowStyle(layout)}
      onClick={onActivate}
      className={cn("min-w-0 w-full overflow-hidden justify-start rounded-[2px] py-0 !font-normal transition-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0", resourceSelection ? "bg-transparent" : ["focus-visible:bg-emerald-50", selected ? "bg-emerald-50 text-green-700 hover:bg-emerald-50 hover:text-green-700 cursor-pointer shadow-none" : "text-stone-700 hover:bg-[#f0efed] hover:text-stone-900"])}
    >
      <span
        aria-hidden
        className="flex size-3 shrink-0 items-center justify-center"
      >
        {folder && <ChevronRight className={cn("!size-3 text-stone-400 transition-transform", expanded && "rotate-90")} />}
      </span>
      {showLoading ? (
        <LoaderCircle className="!size-[var(--tree-icon-size)] shrink-0 animate-spin text-stone-400" />
      ) : <FileThemeIcon name={node.path} directory={folder} expanded={expanded} root={node.path === rootPath} className="!size-[var(--tree-icon-size)] shrink-0 object-contain"
        fallback={folder ? <Folder data-tree-icon="folder" className="!size-[var(--tree-icon-size)] text-amber-500" /> : <File data-tree-icon="file" className={cn("!size-[var(--tree-icon-size)]", appearance.color)} />} />}

      <span
        data-tree-label
        className={cn("min-w-0 flex-1 truncate text-left", folder && layout.folderBold && "font-semibold", git?.text)}
      >
        {node.name}
      </span>
      {error ? (
        <span className="text-[10px] text-red-500">重试</span>
      ) : (
        !folder && showTypeBadge &&
        appearance.label && (
          <span
            data-tree-badge={appearance.label?.toLowerCase()}
            className={cn("shrink-0 rounded px-1 py-0 text-[9px] leading-4 font-semibold", appearance.badge)}
          >
            {appearance.label}
          </span>
        )
      )}
      {!error && git && (folder
        ? <span aria-label={git.title} data-git-status={gitCode} className={cn("mr-2 size-1.5 shrink-0 rounded-full bg-current opacity-60", git.text)} />
        : <span aria-label={git.title} data-git-status={gitCode} className={cn("mr-2 w-3 shrink-0 text-center text-[10px] font-semibold leading-4", git.text)}>{git.label}</span>)}
    </Button>
  )
}
