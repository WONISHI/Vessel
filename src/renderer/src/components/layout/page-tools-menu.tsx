import { ScrollArea } from "@/components/ui/scroll-area"
import { useOpenedResourceProjects } from "@/pages/resources/opened-projects"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Check, CircleQuestionMark, ExternalLink, FolderOpen, PanelLeftClose, PanelLeftOpen, PanelTopClose, PanelTopOpen, RefreshCcw, Search, SquareTerminal } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useWorkspaceSync } from "./use-workspace-sync"
import { type LibraryProject } from "@/pages/resources/library-state"
import { openResourceProject } from "@/pages/resources/open-project"
import { useBrowserTabs } from "@/pages/browser/tab-state"
import { isOpenableUrl } from "@/pages/browser/openable-url"
import { BrowserExternalDialog } from "@/pages/browser/components/browser-page/browser-external-dialog"
import { toast } from "@/components/ui/sonner"
import { useProjectSwitchConfirmation } from "@/pages/resources/use-project-switch-confirmation"
import type { FilePickerRequest, FilePickerWorkspace } from "@/components/workspace-file-picker/types"
import { ApiHelpDialog } from "@/pages/postman/components/api-help-dialog"
import "@vscode/codicons/dist/codicon.css"

export function PageToolsMenu({ browser }: { browser: boolean }) {
  const tabs = useBrowserTabs()
  const activeURL = tabs.find(tab => tab.active)?.url ?? ""
  const [externalURL, setExternalURL] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const openingHelp = useRef(false)
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
  const apiClient = /^\/api-client(\/|$)/.test(pathname)
  const sync = useWorkspaceSync(workspace)
  const openedProjects = useOpenedResourceProjects()
  const [opening, setOpening] = useState(false)
  const [editorRoot, setEditorRoot] = useState<string>()
  const [openingEditor, setOpeningEditor] = useState(false)
  const requestEditorRoot = () => {
    let root: string | undefined
    try {
      const selected = JSON.parse(localStorage.getItem(resources ? "resource_current_project" : "app_current_workspace") || "null")
      if (typeof selected?.path === "string") root = selected.path
    } catch { /* The active controller can still supply its project path. */ }
    const provide: FilePickerRequest = Object.assign((value: FilePickerWorkspace) => { root = value.root }, { scope: resources ? "resources" as const : "workspace" as const })
    window.dispatchEvent(new CustomEvent("vessel:request-workspace-files", { detail: provide }))
    setEditorRoot(root)
  }
  const openInEditor = async () => {
    if (!editorRoot || openingEditor) return
    setOpeningEditor(true)
    try { await window.electronAPI.openProjectInEditor(editorRoot) }
    catch (error) { toast.error(String(error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")) }
    finally { setOpeningEditor(false) }
  }
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
    if (browser || apiClient) return
    const update = (event: Event) => setConsoleOpen((event as CustomEvent<boolean>).detail === true)
    window.addEventListener("vessel:workspace-console-state", update)
    window.dispatchEvent(new Event("vessel:request-workspace-console-state"))
    return () => window.removeEventListener("vessel:workspace-console-state", update)
  }, [browser, apiClient, pathname])
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
    if (!browser && !apiClient) window.dispatchEvent(new Event("vessel:request-workspace-console-state"))
    if (workspace || resources) { requestSidebar(); requestEditorRoot() }
    if (workspace) window.dispatchEvent(new Event("vessel:request-page-sync-state"))
  }}>
    <DropdownMenuTrigger asChild><button type="button" aria-label="页面工具" data-title="页面工具" className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-white/10"><i aria-hidden="true" className="codicon codicon-tools !text-base" /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} onCloseAutoFocus={event => {
      if (!openingHelp.current) return
      openingHelp.current = false
      event.preventDefault()
    }} className={`vessel-activity-tools-popup z-[510] ${browser ? "w-52" : "w-[10.2rem]"} rounded-xl p-1`}>
      {apiClient ? <DropdownMenuItem className={itemClass} onSelect={() => { openingHelp.current = true; setHelpOpen(true) }}><CircleQuestionMark />帮助</DropdownMenuItem> : browser ? <>
        <DropdownMenuItem className={itemClass} onSelect={() => window.dispatchEvent(new Event("vessel-browser-toggle-toolbar"))}><ToggleIcon />{toolbarCollapsed ? "展开搜索栏" : "折叠搜索栏"}</DropdownMenuItem>
        <DropdownMenuItem className={itemClass} onSelect={() => window.dispatchEvent(new Event("vessel-browser-open-find"))}><Search />搜索</DropdownMenuItem>
        <DropdownMenuItem className={itemClass} disabled={!isOpenableUrl(activeURL)} onSelect={() => setExternalURL(activeURL)}><ExternalLink />在默认浏览器中打开</DropdownMenuItem>
      </> : <>
        <DropdownMenuItem className={itemClass} onSelect={() => window.dispatchEvent(new Event("vessel:toggle-workspace-console"))}><SquareTerminal />{consoleOpen ? "关闭控制台" : "打开控制台"}</DropdownMenuItem>
        {(workspace || resources) && <DropdownMenuItem className={itemClass} onSelect={() => sidebarAction.current?.(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}{sidebarOpen ? "关闭侧边栏" : "打开侧边栏"}</DropdownMenuItem>}
        {(workspace || resources) && <DropdownMenuItem className={itemClass} disabled={!editorRoot || openingEditor} onSelect={() => { void openInEditor() }}><ExternalLink />{openingEditor ? "正在打开…" : "在编辑器中打开"}</DropdownMenuItem>}
        {workspace && <DropdownMenuItem className={itemClass} disabled={!sync.enabled || sync.running} onSelect={() => { void sync.sync() }}><RefreshCcw className={sync.running ? "animate-spin" : ""} />{sync.running ? "正在同步…" : "同步"}</DropdownMenuItem>}
        {resources && <DropdownMenuSub>
          <DropdownMenuSubTrigger className={itemClass} disabled={opening}><FolderOpen />切换项目</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="vessel-activity-tools-popup z-[511] w-60 rounded-xl p-1">
            <DropdownMenuLabel className="text-[11px] font-normal text-stone-400">已打开的项目</DropdownMenuLabel>
            <ScrollArea type="hover" className="max-h-64 [&_[data-radix-scroll-area-viewport]]:max-h-64">
            {openedProjects.map(project => <DropdownMenuItem key={project.path} className={itemClass} disabled={opening} aria-current={project.path === editorRoot ? "true" : undefined} data-title={project.path} data-title-side="left" onSelect={() => { void requestOpenProject(project) }}><FolderOpen className="shrink-0" /><span className="min-w-0 flex-1 truncate">{project.name}</span>{project.path === editorRoot && <Check className="ml-auto shrink-0" />}</DropdownMenuItem>)}
            {!openedProjects.length && <DropdownMenuItem disabled className="text-xs">暂无已打开的项目</DropdownMenuItem>}
            </ScrollArea>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={itemClass} disabled={opening} onSelect={() => { void requestOpenProject() }}><FolderOpen />打开其他项目…</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>}
      </>}
    </DropdownMenuContent>
  </DropdownMenu>{confirmation}{helpOpen && <ApiHelpDialog onClose={() => setHelpOpen(false)} />}{externalURL !== null && <BrowserExternalDialog url={externalURL} open onOpenChange={open => { if (!open) setExternalURL(null) }} />}</>
}
