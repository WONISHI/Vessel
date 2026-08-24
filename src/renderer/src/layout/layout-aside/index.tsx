import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FileText, Folder, ChevronRight } from "lucide-react"
import Logo from "@/assets/logo.png"
import { useEffect, useState, useMemo, useCallback } from "react"
import { WorkspaceProvider } from "../contexts/WorkspaceProvider"
import { cn } from "@/lib/utils"

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
        <SidebarMenuButton
          onClick={() => onFileClick(node.path)}
          className={cn("h-8 transition-all hover:bg-zinc-100 text-zinc-500", active && "bg-zinc-100 text-zinc-900 font-medium")}
        >
          <FileText className={cn("h-3.5 w-3.5", active ? "text-teal-600" : "text-zinc-400")} />
          <span className="truncate text-xs">{node.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem className="w-[calc(100%_-_0.5em)]">
      <Collapsible
        className="group/collapsible"
        open={collapsibleFold.includes(node.path)}
        onOpenChange={(open: boolean) => onOpenChange(open, node.path)}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="h-8 hover:bg-zinc-100 text-zinc-600">
            <Folder className="h-3.5 w-3.5 text-teal-600/60" />
            <span className="truncate text-xs font-semibold">{node.name}</span>
            <ChevronRight className="ml-auto h-3 w-3 transition-transform text-zinc-300 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenu className="w-[calc(100%_-_0.25em)] ml-3 border-l border-zinc-200/60 pl-1">
            {node.children?.map((child: any) => (
              <NavItem
                key={child.path}
                activeFilePath={activeFilePath}
                node={child}
                collapsibleFold={collapsibleFold}
                setCollapsibleFold={setCollapsibleFold}
                onFileClick={onFileClick}
              />
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
    console.log("Save file")
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
        changeCollapsible
      }}
    >
      <Sidebar
        variant="floating"
        className="border-r-0 bg-zinc-50/80"
      >
        <SidebarHeader className="p-4 flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/80 flex items-center justify-center p-1.5">
            <img
              src={Logo}
              className="w-full h-full object-contain"
              alt="Logo"
            />
          </div>
          <span className="truncate text-sm font-semibold text-zinc-800">{workspace.name}</span>
        </SidebarHeader>
        <SidebarContent className="px-2 mt-1">
          <SidebarMenu>
            {workspace.files.map((node: any) => (
              <NavItem
                key={node.path}
                activeFilePath={activeFilePath}
                node={node}
                collapsibleFold={collapsibleFold}
                setCollapsibleFold={setCollapsibleFold}
                onFileClick={onFileClick}
              />
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      {children}
    </WorkspaceProvider>
  )
}
