import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { LayoutGrid, Settings } from "lucide-react"
import { ACTIVITY_ITEMS } from "./activity-bar/constants"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { selectLastPinned } from "@/pages/resources/library-state"

/** Navigation remains available in the title bar while the activity rail is hidden. */
export function ActivityMenu() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [enabled, setEnabled] = useState({ search: false, attachments: false })
  useEffect(() => {
    let alive = true
    const update = () => {
      void window.electronAPI?.getSettings?.().then((settings) => {
        if (alive) setEnabled({ search: !!settings.globalSearchEnabled, attachments: settings.attachmentLibraryEnabled === true })
      }).catch(() => {})
    }
    update()
    window.addEventListener("vessel:settings-saved", update)
    return () => { alive = false; window.removeEventListener("vessel:settings-saved", update) }
  }, [])
  const route = (id: string) => id === "files" ? "/editor" : id === "postman" ? "/api-client" : `/${id}`
  const open = (id: string) => {
    if (id === "resources") selectLastPinned()
    const last = id === "files" ? sessionStorage.getItem("vessel-last-editor-route") : null
    void navigate(last?.startsWith("/editor") ? last : route(id))
  }
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild><button type="button" aria-label="活动栏菜单" data-title="活动栏菜单" className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-stone-200 data-[state=open]:bg-stone-200 dark:text-stone-400 dark:hover:bg-white/10 dark:data-[state=open]:bg-white/10"><LayoutGrid className="size-4" /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" side="bottom" sideOffset={6} collisionPadding={8} data-radix-context-menu-content="" className="z-[510] w-48 rounded-lg p-1" onCloseAutoFocus={(event) => event.preventDefault()}>
      <ScrollArea className="max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] [&_[data-radix-scroll-area-viewport]]:max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] [&_[data-radix-scroll-area-viewport]>div]:!block">
        {ACTIVITY_ITEMS.filter((item) => (item.id !== "search" || enabled.search) && (item.id !== "attachments" || enabled.attachments)).map(({id,label,icon:Icon}) => {
          const active = pathname === route(id) || pathname.startsWith(route(id) + "/")
          return <DropdownMenuItem key={id} aria-current={active ? "page" : undefined} className={`gap-2 rounded-md text-xs [&_svg]:size-3.5 ${active ? "bg-emerald-50 text-green-700 dark:bg-emerald-500/10 dark:text-green-400" : ""}`} onSelect={() => open(id)}><Icon />{label}</DropdownMenuItem>
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 rounded-md text-xs [&_svg]:size-3.5" onSelect={() => void navigate("/settings")}><Settings />设置</DropdownMenuItem>
      </ScrollArea>
    </DropdownMenuContent>
  </DropdownMenu>
}
