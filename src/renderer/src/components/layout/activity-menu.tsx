import { ScrollArea } from "@/components/ui/scroll-area"
import { ACTIVITY_ITEMS } from "@/components/layout/activity-bar/constants"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { selectLastPinned } from "@/pages/resources/library-state"
import { Grid2X2, Settings } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

/** Navigation remains available when the activity rail is hidden. */
export function ActivityMenu() {
  const pointerInteraction = useRef(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [flags, setFlags] = useState({ search: false, attachments: false })
  useEffect(() => {
    let alive = true
    let revision = 0
    const refresh = () => {
      const request = ++revision
      void window.electronAPI?.getSettings?.().then(settings => {
        if (alive && request === revision) setFlags({ search: settings.globalSearchEnabled === true, attachments: settings.attachmentLibraryEnabled === true })
      }).catch(console.error)
    }
    refresh()
    window.addEventListener("vessel:settings-saved", refresh)
    return () => { alive = false; window.removeEventListener("vessel:settings-saved", refresh) }
  }, [])
  const items = ACTIVITY_ITEMS.filter(item => (item.id !== "search" || flags.search) && (item.id !== "attachments" || flags.attachments))
  const route = (id: typeof ACTIVITY_ITEMS[number]["id"]) => {
    if (id === "files") {
      const last = sessionStorage.getItem("vessel-last-editor-route")
      return last?.startsWith("/editor") ? last : "/editor"
    }
    return id === "postman" ? "/api-client" : `/${id}`
  }
  const itemClass = "gap-2 rounded-md text-xs data-[highlighted]:!bg-green-600 data-[highlighted]:!text-white [&>svg]:size-4"
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild><button type="button" aria-label="活动栏菜单" data-title="活动栏菜单" onPointerDown={() => { pointerInteraction.current = true }} onKeyDown={() => { pointerInteraction.current = false }} className="flex size-6 items-center justify-center rounded text-stone-500 outline-none focus-visible:ring-2 focus-visible:ring-green-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-white/10"><Grid2X2 className="size-4" /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="vessel-activity-tools-popup z-[510] w-48 rounded-xl p-1"
      onPointerDownCapture={() => { pointerInteraction.current = true }}
      onKeyDownCapture={() => { pointerInteraction.current = false }}
      onCloseAutoFocus={(event) => { if (pointerInteraction.current) event.preventDefault() }}>
      <ScrollArea className="max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] [&_[data-radix-scroll-area-viewport]]:max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] [&_[data-radix-scroll-area-viewport]>div]:!block">
      {items.map(({ id, label, icon: Icon }) => {
        const path = route(id)
        const active = id === "files" ? pathname.startsWith("/editor") : pathname === path || pathname.startsWith(`${path}/`)
        return <DropdownMenuItem key={id} aria-current={active ? "page" : undefined} className={`${itemClass} ${active ? "bg-emerald-50 text-green-600 dark:bg-emerald-500/10" : ""}`} onSelect={() => { if (id === "resources") selectLastPinned(); void navigate(path) }}><Icon />{label}</DropdownMenuItem>
      })}
      <DropdownMenuSeparator />
      <DropdownMenuItem className={itemClass} onSelect={() => void navigate("/settings")}><Settings />设置</DropdownMenuItem>
      </ScrollArea>
    </DropdownMenuContent>
  </DropdownMenu>
}
