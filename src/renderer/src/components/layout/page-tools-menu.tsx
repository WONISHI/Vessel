import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PanelTopClose, PanelTopOpen, Search, Terminal } from "lucide-react"
import { useEffect, useState } from "react"
import "@vscode/codicons/dist/codicon.css"

export function PageToolsMenu({ browser }: { browser: boolean }) {
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  useEffect(() => {
    if (!browser) return
    const update = (event: Event) => setToolbarCollapsed((event as CustomEvent<boolean>).detail === true)
    window.addEventListener("vessel-browser-toolbar-state", update)
    window.dispatchEvent(new Event("vessel-browser-request-toolbar-state"))
    return () => window.removeEventListener("vessel-browser-toolbar-state", update)
  }, [browser])
  const itemClass = "gap-2 rounded-md text-xs data-[highlighted]:!bg-green-600 data-[highlighted]:!text-white [&>svg]:size-4"
  const ToggleIcon = toolbarCollapsed ? PanelTopOpen : PanelTopClose
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild><button type="button" aria-label="页面工具" data-title="页面工具" className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-white/10"><i aria-hidden="true" className="codicon codicon-tools !text-base" /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="vessel-activity-tools-popup z-[510] w-32 rounded-xl p-1">
      {browser ? <>
        <DropdownMenuItem className={itemClass} onSelect={() => window.dispatchEvent(new Event("vessel-browser-toggle-toolbar"))}><ToggleIcon />{toolbarCollapsed ? "展开搜索栏" : "折叠搜索栏"}</DropdownMenuItem>
        <DropdownMenuItem className={itemClass} onSelect={() => window.dispatchEvent(new Event("vessel-browser-open-find"))}><Search />搜索</DropdownMenuItem>
      </> : <DropdownMenuItem className={itemClass} onSelect={() => window.dispatchEvent(new Event("vessel:open-workspace-console"))}><Terminal />打开控制台</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>
}
