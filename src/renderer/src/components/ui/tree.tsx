import React from "react"
import { ChevronRight, File as FileIcon, Folder as FolderIcon, type LucideIcon } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

// --- 类型定义 ---

interface TreeContextProps {
  selectedId?: string
  handleSelect: (id: string) => void
}

const TreeContext = React.createContext<TreeContextProps | undefined>(undefined)

// --- 基础组件 ---

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  data?: any[]
  initialSelectedId?: string
  onSelect?: (item: any) => void
  children?: React.ReactNode
}

const Tree = React.forwardRef<HTMLDivElement, TreeProps>(
  ({ className, data, initialSelectedId, onSelect, children, ...props }, ref) => {
    const [selectedId, setSelectedId] = React.useState<string | undefined>(initialSelectedId)

    const handleSelect = React.useCallback((id: string) => {
      setSelectedId(id)
      if (onSelect) {
        onSelect(id)
      }
    }, [onSelect])

    return (
      <TreeContext.Provider value={{ selectedId, handleSelect }}>
        <div ref={ref} className={cn("grid gap-1", className)} {...props}>
          {children}
        </div>
      </TreeContext.Provider>
    )
  }
)
Tree.displayName = "Tree"

// --- 文件夹组件 ---

interface FolderProps extends React.ComponentPropsWithoutRef<typeof Collapsible> {
  name: string
  icon?: LucideIcon
}

const Folder = React.forwardRef<HTMLDivElement, FolderProps>(
  ({ className, name, icon: Icon = FolderIcon, children, ...props }, ref) => {
    return (
      <Collapsible className={cn("group/folder w-full", className)} {...props}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-slate-100",
              "text-slate-600 transition-colors"
            )}
          >
            <Icon className="h-4 w-4 text-blue-400/70" />
            <span className="flex-1 text-left truncate">{name}</span>
            <ChevronRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-data-[state=open]/folder:rotate-90" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="relative ml-2.5 flex flex-col gap-1 border-l pl-2 py-1">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }
)
Folder.displayName = "Folder"

// --- 文件组件 ---

interface FileProps extends React.HTMLAttributes<HTMLButtonElement> {
  id: string
  name: string
  icon?: LucideIcon
}

const File = React.forwardRef<HTMLButtonElement, FileProps>(
  ({ className, id, name, icon: Icon = FileIcon, ...props }, ref) => {
    const context = React.useContext(TreeContext)
    const isSelected = context?.selectedId === id

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => context?.handleSelect(id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          isSelected 
            ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" 
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
          className
        )}
        {...props}
      >
        <Icon className={cn("h-4 w-4", isSelected ? "text-blue-500" : "text-slate-400")} />
        <span className="flex-1 text-left truncate">{name}</span>
      </button>
    )
  }
)
File.displayName = "File"

// --- 递归渲染器 (开箱即用) ---

interface TreeViewProps extends TreeProps {
  data: any[]
  itemClassName?: string
}

function TreeView({ data, itemClassName, ...props }: TreeViewProps) {
  const renderNode = (node: any) => {
    if (node.children && node.children.length > 0) {
      return (
        <Folder key={node.path} name={node.name} className={itemClassName}>
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

  return (
    <Tree {...props}>
      {data.map(renderNode)}
    </Tree>
  )
}

export { Tree, Folder, File, TreeView }