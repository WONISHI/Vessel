import React from "react"
import { ChevronRight, File as FileIcon, Folder as FolderIcon, type LucideIcon } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface TreeContextProps {
  indent: number
  selectedId?: string
  handleSelect: (id: string) => void
}

const TreeContext = React.createContext<TreeContextProps | undefined>(undefined)

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 每层缩进距离（px），默认 19；0 表示不缩进。 */
  indent?: number
  data?: any[]
  initialSelectedId?: string
  onSelect?: (item: any) => void
  children?: React.ReactNode
}

const Tree = React.forwardRef<HTMLDivElement, TreeProps>(({ className, initialSelectedId, onSelect, children, indent = 19, ...props }, ref) => {
  const [selectedId, setSelectedId] = React.useState<string | undefined>(initialSelectedId)

  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedId(id)
      if (onSelect) {
        onSelect(id)
      }
    },
    [onSelect]
  )

  return (
    <TreeContext.Provider value={{ selectedId, handleSelect, indent: Number.isFinite(indent) ? Math.max(0, indent) : 19 }}>
      <div
        ref={ref}
        className={cn("grid gap-1", className)}
        {...props}
      >
        {children}
      </div>
    </TreeContext.Provider>
  )
})
Tree.displayName = "Tree"

interface FolderProps extends React.ComponentPropsWithoutRef<typeof Collapsible> {
  name: string
  icon?: LucideIcon
}

const Folder = React.forwardRef<HTMLDivElement, FolderProps>(({ className, name, icon: Icon = FolderIcon, children, ...props }, ref) => {
  const indent = React.useContext(TreeContext)?.indent ?? 19
  return (
    <Collapsible
      ref={ref}
      className={cn("group/folder w-full", className)}
      {...props}
    >
      <CollapsibleTrigger asChild>
        <button className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-zinc-100", "text-zinc-600 transition-colors")}>
          <Icon className="h-4 w-4 text-teal-600/60" />
          <span className="flex-1 text-left truncate">{name}</span>
          <ChevronRight className="h-4 w-4 text-zinc-400 transition-transform duration-200 group-data-[state=open]/folder:rotate-90" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div
          className="relative flex flex-col gap-1 py-1"
          style={{ paddingLeft: indent }}
        >
          {indent > 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 border-l border-zinc-200/60"
              style={{ left: Math.max(0, indent - 9) }}
            />
          )}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
})
Folder.displayName = "Folder"

interface FileProps extends React.HTMLAttributes<HTMLButtonElement> {
  id: string
  name: string
  icon?: LucideIcon
}

const File = React.forwardRef<HTMLButtonElement, FileProps>(({ className, id, name, icon: Icon = FileIcon, ...props }, ref) => {
  const context = React.useContext(TreeContext)
  const isSelected = context?.selectedId === id

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => context?.handleSelect(id)}
      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors", isSelected ? "bg-white text-teal-700 shadow-sm ring-1 ring-zinc-200" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900", className)}
      {...props}
    >
      <Icon className={cn("h-4 w-4", isSelected ? "text-teal-600" : "text-zinc-400")} />
      <span className="flex-1 text-left truncate">{name}</span>
    </button>
  )
})
File.displayName = "File"

interface TreeViewProps extends TreeProps {
  data: any[]
  itemClassName?: string
}

function TreeView({ data, itemClassName, ...props }: TreeViewProps) {
  const renderNode = (node: any) => {
    if (node.children && node.children.length > 0) {
      return (
        <Folder
          key={node.path}
          name={node.name}
          className={itemClassName}
        >
          {node.children.map(renderNode)}
        </Folder>
      )
    }
    return (
      <File
        key={node.path}
        id={node.path}
        name={node.name}
        className={itemClassName}
      />
    )
  }

  return <Tree {...props}>{data.map(renderNode)}</Tree>
}

export { Tree, Folder, File, TreeView }

/** 固定行高的可见树列表。展开与异步加载由调用方管理。 */
export interface VirtualTreeRow<T> {
  id: string
  depth: number
  item: T
  expanded?: boolean
}
export interface VirtualTreeProps<T> {
  rows: readonly VirtualTreeRow<T>[]
  viewport: HTMLElement | null
  /** 每层缩进距离（px），默认 12；0 表示不缩进。 */
  indent?: number
  rowHeight?: number
  overscan?: number
  selectedId?: string
  renderRow: (row: VirtualTreeRow<T>) => React.ReactNode
}
export function VirtualTree<T>({ rows, viewport, indent = 12, rowHeight = 32, overscan = 6, selectedId, renderRow }: VirtualTreeProps<T>) {
  const [windowState, setWindowState] = React.useState({ top: 0, height: 0 })
  React.useEffect(() => {
    if (!viewport) return
    const update = () => setWindowState({ top: viewport.scrollTop, height: viewport.clientHeight })
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    viewport.addEventListener("scroll", update, { passive: true })
    update()
    return () => {
      observer.disconnect()
      viewport.removeEventListener("scroll", update)
    }
  }, [viewport])
  const height = rows.length * rowHeight
  const top = Math.min(windowState.top, Math.max(0, height - windowState.height))
  const start = Math.max(0, Math.floor(top / rowHeight) - overscan)
  const end = Math.min(rows.length, Math.ceil((top + windowState.height) / rowHeight) + overscan)
  return (
    <div
      role="tree"
      aria-label="工作区文件树"
      className="relative w-full"
      style={{ height }}
    >
      {rows.slice(start, end).map((row, index) => (
        <div
          key={row.id}
          role="treeitem"
          aria-level={row.depth + 1}
          aria-expanded={row.expanded}
          aria-selected={row.id === selectedId}
          className="absolute left-0 top-0 w-full"
          style={{ height: rowHeight, transform: `translateY(${(start + index) * rowHeight}px)`, paddingLeft: row.depth * (Number.isFinite(indent) ? Math.max(0, indent) : 12) }}
        >
          {renderRow(row)}
        </div>
      ))}
    </div>
  )
}
