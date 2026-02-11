import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FileText, Folder, ChevronRight } from "lucide-react"
import Logo from "@/assets/logo.png"
import { useEffect, useState, useMemo, useCallback } from "react"
import { WorkspaceProvider } from "../contexts/WorkspaceProvider"
import { cn } from "@/lib/utils"

// 分离 NavItem 组件
function NavItem({ node, activeFilePath, collapsibleFold, setCollapsibleFold, onFileClick }: any) {
  const onOpenChange = useCallback(
    (open: boolean, path: string) => {
      setCollapsibleFold((collapsible: string[]) => {
        if (open && !collapsible.includes(path)) {
          return [...collapsible, path]
        } else if (!open && collapsible.includes(path)) {
          return collapsible.filter((i) => i !== path)
        }
        return collapsible
      })
    },
    [setCollapsibleFold]
  )

  const active = node.path === activeFilePath

  if (node.type === "file") {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => onFileClick(node.path)} className={cn("h-9 transition-all hover:bg-white text-slate-500", active && "bg-white text-blue-600 shadow-sm font-medium")}>
          <FileText className={cn("h-3.5 w-3.5", active ? "text-blue-500" : "text-slate-400")} />
          <span className="truncate text-xs">{node.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem className="w-[calc(100%_-_0.5em)]">
      <Collapsible className="group/collapsible" open={collapsibleFold.includes(node.path)} onOpenChange={(open: boolean) => onOpenChange(open, node.path)}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="h-9 hover:bg-white text-slate-600">
            <Folder className="h-3.5 w-3.5 text-blue-400/70" />
            <span className="truncate text-xs font-bold">{node.name}</span>
            <ChevronRight className="ml-auto h-3 w-3 transition-transform text-slate-300 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenu className="w-[calc(100%_-_0.25em)] ml-3 border-l border-slate-200/60 pl-1">
            {node.children?.map((child: any) => (
              <NavItem key={child.path} activeFilePath={activeFilePath} node={child} collapsibleFold={collapsibleFold} setCollapsibleFold={setCollapsibleFold} onFileClick={onFileClick} />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}

export default function LayoutSide({ workspace, children }: any) {
  const [activeFilePath, setActiveFilePath] = useState<string>("")
  const [collapsibleFold, setCollapsibleFold] = useState<string[]>([])

  const fileType = useMemo(() => {
    if (!activeFilePath) return ""
    const parts = activeFilePath.split(".")
    return parts.length > 1 ? parts.pop() : ""
  }, [activeFilePath])

  const changeCollapsible = useCallback((path: string) => {
    setCollapsibleFold((prev) => {
      if (!prev.includes(path)) {
        return [...prev, path]
      }
      return prev
    })
  }, [])

  const onFileClick = useCallback((path: string) => {
    setActiveFilePath(path)
  }, [])

  const onSave = useCallback(() => {
    console.log("保存文件")
  }, [])

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    if (workspace?.files?.length > 0 && !activeFilePath) {
      const firstRootFile = workspace.files.find((node: any) => node.type === "file")
      if (firstRootFile) {
        timer = setTimeout(() => {
          setActiveFilePath(firstRootFile.path)
        }, 0)
      }
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [workspace, activeFilePath])

  return (
    <WorkspaceProvider
      value={{
        workspace,
        activeFilePath,
        fileType,
        onSave,
        changeCollapsible,
      }}
    >
      <Sidebar variant="floating" className="border-r-0 bg-slate-50/50">
        <SidebarHeader className="p-4 flex flex-row items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center p-1.5">
            <img src={Logo} className="w-full h-full object-contain" alt="Logo" />
          </div>
          <div className="flex flex-col overflow-hidden text-left leading-tight">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace</span>
            <span className="truncate text-sm font-bold text-slate-800">{workspace.name}</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 mt-2">
          <SidebarMenu>
            {workspace.files.map((node: any) => (
              <NavItem key={node.path} activeFilePath={activeFilePath} node={node} collapsibleFold={collapsibleFold} setCollapsibleFold={setCollapsibleFold} onFileClick={onFileClick} />
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      {/* 这里的 children 就是 LayoutMain */}
      {children}
    </WorkspaceProvider>
  )
}
