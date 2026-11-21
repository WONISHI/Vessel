import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FolderOpen, PanelLeftClose, PanelLeftOpen, PanelTopClose, PanelTopOpen, RefreshCcw, Search, SquareTerminal } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useWorkspaceSync } from "./use-workspace-sync"
import { useLibraryMeta, type LibraryProject } from "@/pages/resources/library-state"
import { openResourceProject, refreshRecentResourceProjects } from "@/pages/resources/open-project"
import { toast } from "@/components/ui/sonner"
import { useProjectSwitchConfirmation } from "@/pages/resources/use-project-switch-confirmation"
import "@vscode/codicons/dist/codicon.css"

export function PageToolsMenu({ browser }: { browser: boolean }) {
  const { requestSwitch, confirmation } = useProjectSwitchConfirmation()
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const sidebarAction = useRef<((open: boolean) => void) | undefined>(undefined)
  const requestSidebar = () => window.dispatchEvent(new CustomEvent("vessel:request-page-sidebar-state", {
    detail: (open: boolean, change: (open: boolean) => void) => { setSidebarOpen(open); sidebarAction.current = change }
  }))
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const resources = /^\/resources(\/|$)/.test(pathname)
  const workspace = /^\/editor(\/|$)/.test(pathname)
  const sync = useWorkspaceSync(workspace)
  const { recent = [] } = useLibraryMeta()
  const [opening, setOpening] = useState(false)
  const loadRecent = () => { void refreshRecentResourceProjects().catch(error => toast.error(String(error))) }
  useEffect(() => {
    if (resources) void refreshRecentResourceProjects().catch(error => toast.error(String(error)))
  }, [resources])
  const openProject = async (project?: LibraryProject) => {
    if (opening) return
    setOpening(true)
    try {
      const target = project || await window.electronAPI.openDirectory()
      if (!target) return
      await openResourceProject(target)
      void navigate("/resources")
    } catch (error) { toast.error(String(error)) }
    finally { setOpening(false) }
  }
  const requestOpenProject = async (project?: LibraryProject) => {
    if (opening) return
    try {
      const target = project || await window.electronAPI.openDirectory()
      if (target) requestSwitch(target, () => { void openProject(target) })
    } catch (error) { toast.error(String(error)) }
  }
  useEffect(() => {
    if (browser) return
    const update = (event: Event) => setConsoleOpen((event as CustomEvent<boolean>).detail === true)
    window.addEventListener("vessel:workspace-console-state", update)
    window.dispatchEvent(new Event("vessel:request-workspace-console-state"))
    return () => window.removeEventListener("vessel:workspace-console-state", update)
  }, [browser, pathname])
  useEffect(() => {
    if (!browser) return
    const update = (event: Event) => setToolbarCollapsed((event as CustomEvent<boolean>).detail === true)
    window.addEventListener("vessel-browser-toolbar-state", update)
    window.dispatchEvent(new Event("vessel-browser-request-toolbar-state"))
    return () => window.removeEventListener("vessel-browser-toolbar-state", update)
  }, [browser])
  const itemClass = "gap-2 rounded-md text-xs data-[highlighted]:!bg-green-600 data-[highlighted]:!text-white [&>svg]:size-4"
  const ToggleIcon = toolbarCollapsed ? PanelTopOpen : PanelTopClose
  return <><DropdownMenu modal={false} onOpenChange={(open) => {
    if (!open) return
    if (!browser) window.dispatchEvent(new Event("vessel:request-workspace-console-state"))
    if (workspace || resources) requestSidebar()
    if (workspace) window.dispatchEvent(new Event("vessel:request-page-sync-state"))
    if (resources) loadRecent()
  }}>
    <DropdownMenuTrigger asChild><button type="button" aria-label="页面工具" data-title="页面工具" className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-white/10"><i aria-hidden="true" className="codicon codicon-tools !text-base" /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="vessel-activity-tools-popup z-[510] w-[10.2rem] rounded-xl p-1">
      {browser ? <>
        <DropdownMenuItem className={itemClass} onSelect={() => window.dispatchEvent(new Event("vessel-browser-toggle-toolbar"))}><ToggleIcon />{toolbarCollapsed ? "展开搜索栏" : "折叠搜索栏"}</DropdownMenuItem>
        <DropdownMenuItem className={itemClass} onSelect={() => window.dispatchEvent(new Event("vessel-browser-open-find"))}><Search />搜索</DropdownMenuItem>
      </> : <>
        <DropdownMenuItem className={itemClass} onSelect={() => window.dispatchEvent(new Event("vessel:toggle-workspace-console"))}><SquareTerminal />{consoleOpen ? "关闭控制台" : "打开控制台"}</DropdownMenuItem>
        {(workspace || resources) && <DropdownMenuItem className={itemClass} onSelect={() => sidebarAction.current?.(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}{sidebarOpen ? "关闭侧边栏" : "打开侧边栏"}</DropdownMenuItem>}
        {workspace && <DropdownMenuItem className={itemClass} disabled={!sync.enabled || sync.running} onSelect={() => { void sync.sync() }}><RefreshCcw className={sync.running ? "animate-spin" : ""} />{sync.running ? "正在同步…" : "同步"}</DropdownMenuItem>}
        {resources && <DropdownMenuSub>
          <DropdownMenuSubTrigger className={itemClass} disabled={opening}><FolderOpen />打开项目</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="vessel-activity-tools-popup z-[511] w-60 rounded-xl p-1">
            <DropdownMenuLabel className="text-[11px] font-normal text-stone-400">最近打开的项目</DropdownMenuLabel>
            {recent.slice(0, 5).map(project => <DropdownMenuItem key={project.path} className={itemClass} disabled={opening} data-title={project.path} data-title-side="left" onSelect={() => { void requestOpenProject(project) }}><FolderOpen className="shrink-0" /><span className="truncate">{project.name}</span></DropdownMenuItem>)}
            {!recent.length && <DropdownMenuItem disabled className="text-xs">暂无最近项目</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem className={itemClass} disabled={opening} onSelect={() => { void requestOpenProject() }}><FolderOpen />打开其他项目…</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>}
      </>}
    </DropdownMenuContent>
  </DropdownMenu>{confirmation}</>
}
