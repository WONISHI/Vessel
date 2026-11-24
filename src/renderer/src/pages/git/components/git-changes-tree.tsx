import { useState, type CSSProperties, type ReactNode } from "react"
import { ChevronRight, Folder, FolderOpen } from "lucide-react"
import type { GitFileStatus } from "@vessel/type"
import { FileThemeIcon } from "@/features/file-icons"
import { FileIconScope } from "@/features/file-icons/state"
import { useDirectoryTreeLayout } from "@/features/directory-tree/state"
import { matchesGitFilePath } from "../file-filter"
import { gitChangeMarkerClass } from "./file-change-marker"

type FileNode = { kind: "file"; name: string; file: GitFileStatus; index: number }
type FolderNode = { kind: "folder"; name: string; path: string; children: Map<string, FileNode | FolderNode>; status: string }

/** Render the same file rows in flat or directory form, preserving original selection indices. */
export function GitChangesTree({ files, query, tree, renderFile }: { files: GitFileStatus[]; query: string; tree: boolean; renderFile: (file: GitFileStatus, index: number, tree: boolean) => ReactNode }) {
  const layout = useDirectoryTreeLayout("resources")
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  if (!tree) return <>{files.map((file, index) => matchesGitFilePath(file.path, query) ? renderFile(file, index, false) : null)}</>
  const root = new Map<string, FileNode | FolderNode>()
  files.forEach((file, index) => {
    if (!matchesGitFilePath(file.path, query)) return
    const parts = file.path.replace(/\\/g, "/").split("/")
    let children = root
    parts.slice(0, -1).forEach((name, depth) => {
      let folder = children.get(`${name}/`) as FolderNode | undefined
      if (!folder) {
        folder = { kind: "folder", name, path: parts.slice(0, depth + 1).join("/"), children: new Map(), status: file.status }
        children.set(`${name}/`, folder)
      }
      children = folder.children
    })
    children.set(parts.at(-1)!, { kind: "file", name: parts.at(-1)!, file, index })
  })
  const guides = (depth: number) => layout.guides && depth > 0 && layout.indent > 0 ? <span data-tree-guides aria-hidden className="pointer-events-none absolute inset-y-0 z-[1] text-stone-400 opacity-25 dark:text-stone-500" style={{ left: layout.padding + 6, width: `min(${depth * layout.indent}px, max(0px, calc(100% - 140px)))`, backgroundImage: `repeating-linear-gradient(to right,currentColor 0 1px,transparent 1px ${layout.indent}px)` }} /> : null
  const padding = (depth: number, file = false) => `calc(${layout.padding + (file ? 12 + layout.columnGap : 0)}px + min(${depth * layout.indent}px, max(0px, calc(100% - 140px))))`
  const rows = (children: typeof root, depth = 0): ReactNode => Array.from(children.values()).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
    return a.name.localeCompare(b.name, "zh-CN", { numeric: true })
  }).map(node => {
    if (node.kind === "file") return <div key={node.file.path} className="relative" style={{ "--git-tree-padding": padding(depth, true) } as CSSProperties}>{guides(depth)}{renderFile(node.file, node.index, true)}</div>
    const collapseKey = `${query.trim().toLowerCase()}:${node.path}`
    const open = !collapsed.has(collapseKey)
    return <div key={node.path}>
      <div className="relative">{guides(depth)}
      <button type="button" data-git-change-folder aria-label={`${open ? "收起" : "展开"}目录 ${node.path}`} aria-expanded={open} data-title={node.path} style={{ paddingLeft: padding(depth), gap: layout.columnGap }}
        className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded px-2 text-left text-xs text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/5"
        onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(collapseKey)) next.delete(collapseKey); else next.add(collapseKey); return next })}>
        <ChevronRight className={`size-3 shrink-0 text-stone-400 transition-transform ${open ? "rotate-90" : ""}`} />
        <FileIconScope.Provider value="resources"><FileThemeIcon name={node.name} directory expanded={open} className="size-3.5 shrink-0 object-contain" fallback={open ? <FolderOpen className="size-3.5 shrink-0 text-slate-400" /> : <Folder className="size-3.5 shrink-0 fill-slate-400 text-slate-400" />} /></FileIconScope.Provider>
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span aria-hidden className="flex w-[22px] shrink-0 items-center justify-center">
          <span data-git-status-marker className="flex w-3.5 justify-center"><span className={`size-1.5 rounded-full bg-current opacity-60 ${gitChangeMarkerClass(node.status)}`} /></span>
        </span>
      </button>
      </div>
      {open && rows(node.children, depth + 1)}
    </div>
  })
  return <div aria-label="变更文件树" style={{ "--git-tree-column-gap": `${layout.columnGap}px` } as CSSProperties}>{rows(root)}</div>
}
