import { UpdateBell } from "./update-bell"
import { useActivityBarCollapsed } from "@/features/activity-bar/collapse"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { applyAppearance } from "@/pages/settings/appearance"
import { useActivityOverflow } from "@/components/layout/activity-bar/use-activity-overflow"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import Logo from "@/assets/logo.png"
import DarkLogo from "@/assets/logo-dark.svg"
import { ACTIVITY_ITEMS } from "@/components/layout/activity-bar/constants"
import type { LayoutActivityBarProps } from "@/components/layout/activity-bar/types"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { selectLastPinned } from "@/pages/resources/library-state"
import { useRouter } from "@vessel/react-router"
import { Ellipsis, RefreshCcw, Settings, Sun, Moon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"

/** 左侧窄活动栏：应用入口、活动切换和外观标识。 */
export default function LayoutActivityBar({ activity, onActivityChange, onResourceEnter, onResourceLeave }: LayoutActivityBarProps) {
  const dark = useDarkAppearance()
  const collapsed = useActivityBarCollapsed()
  const location = useLocation()
  const [moreToolsOpen, setMoreToolsOpen] = useState(false)
  const [moreToolsTooltipOpen, setMoreToolsTooltipOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (location.pathname === "/editor" || location.pathname.startsWith("/editor/")) sessionStorage.setItem("vessel-last-editor-route", location.pathname + location.search)
  }, [location.pathname, location.search])
  const router = useRouter()
  const { open, openMobile, isMobile } = useSidebar()
  const expanded = isMobile ? openMobile : open
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(activity === "attachments")
  const [globalSearchEnabled, setGlobalSearchEnabled] = useState(false)
  const [syncRunning, setSyncRunning] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(false)
  const syncPending = useRef(false)

  /** Synchronizes workspace. */
  const syncWorkspace = async () => {
    if (syncPending.current) return
    syncPending.current = true
    setSyncRunning(true)
    window.dispatchEvent(new Event("vessel:sync-status"))
    try {
      const result = await window.electronAPI.runBackup()
      if (result.error) toast.error(result.error)
      else toast.success("工作区同步完成")
    } catch (error) {
      toast.error(String(error))
    } finally {
      syncPending.current = false
      setSyncRunning(false)
      window.dispatchEvent(new Event("vessel:sync-status"))
    }
  }
  useEffect(() => {
    let cancelled = false

    /** Checks sync. */
    const checkSync = () => {
      void Promise.all([window.electronAPI.getSettings(), window.electronAPI.getBackupStatus()])
        .then(([settings, status]) => {
          if (!cancelled) {
            setSyncEnabled(Boolean(settings?.backup?.enabled && settings.backup.workspacePath))
            setSyncRunning(syncPending.current || Boolean(settings?.backup?.enabled && status?.running))
          }
        })
        .catch(() => { })
    }
    checkSync()
    window.addEventListener("vessel:sync-context", checkSync)
    window.addEventListener("vessel:settings-saved", checkSync)
    window.addEventListener("vessel:sync-status", checkSync)
    const interval = setInterval(() => { if (!document.hidden) checkSync() }, 10000)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener("vessel:sync-context", checkSync)
      window.removeEventListener("vessel:settings-saved", checkSync)
      window.removeEventListener("vessel:sync-status", checkSync)
    }
  }, [])
  useEffect(() => {
    let cancelled = false

    /** Refreshes the current state. */
    const update = () => {
      void window.electronAPI
        .getSettings()
        .then((s) => {
          if (cancelled) return
          setGlobalSearchEnabled(!!s.globalSearchEnabled)
          setAttachmentsEnabled(s.attachmentLibraryEnabled === true)
        })
        .catch(() => { })
    }
    update()
    window.addEventListener("vessel:settings-saved", update)
    return () => {
      cancelled = true
      window.removeEventListener("vessel:settings-saved", update)
    }
  }, [])
  const visibleItems = ACTIVITY_ITEMS.filter((item) => (item.id !== "search" || globalSearchEnabled) && (item.id !== "attachments" || attachmentsEnabled))
  const { railRef, capacity } = useActivityOverflow(visibleItems.length)
  const priorityItems = [...visibleItems].sort((a, b) => {
    /** Keeps the workspace and current activity ahead of secondary entries when space is limited. */
    const priority = (id: string) => (id === "files" ? 0 : id === activity ? 1 : 2)
    return priority(a.id) - priority(b.id)
  })
  const shownIds = new Set(priorityItems.slice(0, capacity).map((item) => item.id))
  const shownItems = visibleItems.filter((item) => shownIds.has(item.id))
  const overflowItems = visibleItems.filter((item) => !shownIds.has(item.id))
  const moreActive = overflowItems.some((item) => item.id === activity)

  /** Opens an activity through the same navigation path in the rail and overflow menu. */
  const openActivity = (id: (typeof visibleItems)[number]["id"]) => {
    setMoreToolsOpen(false)
    if (id === "git" || id === "postman") {
      onActivityChange(id)
      void router.push(id === "git" ? "/git" : "/api-client")
      return
    }
    if (id === "search" || id === "browser") {
      onActivityChange(id)
      void router.push(id === "search" ? "/search" : "/browser")
      return
    }
    if (id === "files") {
      onActivityChange(id)
      const last = sessionStorage.getItem("vessel-last-editor-route")
      void router.push(last?.startsWith("/editor") ? last : "/editor")
      return
    }
    if (id === "resources") {
      selectLastPinned()
      onActivityChange(id)
      void router.push("/resources")
      return
    }
    if (id === "attachments") {
      void router.push("/attachments")
      return
    }
    if (id === "office") {
      void router.push("/office")
      return
    }
    onActivityChange(id)
  }
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    []
  )
  if (collapsed) return null
  return (
    <TooltipProvider delayDuration={250}>
      <nav
        ref={railRef}
        aria-label="工作台活动栏"
        className="flex min-h-0 w-[52px] shrink-0 flex-col items-center gap-1 [&>*]:shrink-0 border-r border-[#f0efed] py-2.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="group/logo relative mb-2 block size-[30px] rounded-lg">
              <img
                src={dark ? DarkLogo : Logo}
                alt=""
                className={cn("pointer-events-none absolute inset-0 size-full object-contain p-0.5", activity !== "browser" && activity !== "office" && "group-hover/logo:opacity-0 group-focus-within/logo:opacity-0")}
              />
              {activity !== "browser" && activity !== "office" ? (
                <SidebarTrigger
                  data-activity-sidebar-toggle
                  aria-label={expanded ? "收起侧边栏" : "展开侧边栏"}
                  aria-expanded={expanded}
                  className="!bg-transparent hover:!bg-stone-100 active:!bg-stone-200 focus:!bg-transparent !shadow-none size-[30px] rounded-lg text-stone-700 [&>svg]:opacity-0 hover:bg-stone-100 group-hover/logo:[&>svg]:!opacity-100 group-focus-within/logo:[&>svg]:!opacity-100"
                />
              ) : null}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="border-stone-200 bg-white text-xs text-stone-700"
          >
            {activity !== "browser" && activity !== "office" ? (expanded ? "收起侧边栏" : "展开侧边栏") : "Vessel"}
          </TooltipContent>
        </Tooltip>
        {shownItems.map(({ id, label, icon: Icon }) => (
          <ContextMenu key={id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <ContextMenuTrigger
                  asChild
                  disabled={id !== "files"}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    data-activity-button
                    aria-label={label}
                    aria-pressed={activity === id}
                    onClick={() => openActivity(id)}
                    onMouseEnter={id === "resources" && activity === "resources" ? onResourceEnter : undefined}
                    onMouseLeave={id === "resources" ? onResourceLeave : undefined}
                    className={cn("relative h-[38px] w-[38px] rounded-[10px] text-[#a8a29e] hover:!bg-[#f0efed] hover:!text-[#a8a29e]", activity === id && "!bg-emerald-50 !text-[#16a34a] hover:!bg-emerald-50 hover:!text-[#16a34a]")}
                  >
                    <Icon className="!size-5" />
                    {id === "files" && syncRunning && (
                      <span
                        data-title="正在同步工作区…"
                        className="pointer-events-none absolute bottom-1 right-1 flex size-3.5 aspect-square shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:bg-stone-900 dark:ring-stone-700"
                      >
                        <RefreshCcw
                          strokeWidth={2.5}
                          className={cn("!size-2.5 animate-spin", activity === id ? "text-[#16a34a]" : "text-[#a8a29e]")}
                        />
                      </span>
                    )}
                  </Button>
                </ContextMenuTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={10}
                className="border-stone-200 bg-white text-xs text-stone-700"
              >
                {label}
              </TooltipContent>
            </Tooltip>
            {id === "files" && (
              <ContextMenuContent className="min-w-[140px] w-[140px]">
                <ContextMenuItem
                  disabled={!syncEnabled || syncRunning}
                  onSelect={() => {
                    void syncWorkspace()
                  }}
                >
                  <RefreshCcw className={syncRunning ? "animate-spin" : ""} />
                  {syncRunning ? "正在同步…" : "同步"}
                </ContextMenuItem>
              </ContextMenuContent>
            )}
          </ContextMenu>
        ))}


        {/* 仅在活动入口放不下时显示折叠菜单。 */}
        {overflowItems.length > 0 && <Popover
          open={moreToolsOpen}
          onOpenChange={setMoreToolsOpen}
        >
          <div
            className="relative flex size-[38px] items-center justify-center"
            onMouseEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current)
              setMoreToolsTooltipOpen(false)
              setMoreToolsOpen(true)
            }}
            onMouseLeave={() => {
              closeTimer.current = setTimeout(() => {
                setMoreToolsOpen(false)
              }, 250)
            }}
          >
            <Tooltip
              open={moreToolsTooltipOpen && !moreToolsOpen}
              onOpenChange={(next) => setMoreToolsTooltipOpen(next && !moreToolsOpen)}
              disableHoverableContent
            >
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-activity-button
                    aria-label="更多活动"
                    onPointerLeave={() => setMoreToolsTooltipOpen(false)}
                    onBlur={() => setMoreToolsTooltipOpen(false)}
                    aria-pressed={moreActive}
                    className={cn("relative h-[38px] w-[38px] rounded-[10px] text-[#a8a29e] hover:!bg-[#f0efed] hover:!text-[#a8a29e]", (moreActive || moreToolsOpen) && "!bg-emerald-50 !text-green-700 hover:!bg-emerald-50 hover:!text-green-700")}
                  >
                    <Ellipsis className="!size-5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={10}
                className="border-stone-200 bg-white text-xs text-stone-700"
              >
                更多活动
              </TooltipContent>
            </Tooltip>

            {/* 悬停/点击浮层：显示 Git、API 和折叠入口 */}
            {moreToolsOpen && (
              <PopoverContent
                side="right"
                align="end"
                sideOffset={6}
                collisionPadding={8}
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => {
                  event.preventDefault()
                  setMoreToolsTooltipOpen(false)
                }}
                className="vessel-activity-tools-popup z-[510] max-h-[var(--radix-popover-content-available-height)] w-56 overflow-hidden rounded-xl border border-stone-200 bg-white p-0 shadow-xl dark:!border-white/10 dark:!bg-[#1f2329] dark:shadow-[0_12px_32px_rgba(0,0,0,.5)]"
                onMouseEnter={() => {
                  if (closeTimer.current) clearTimeout(closeTimer.current)
                }}
                onMouseLeave={() => {
                  closeTimer.current = setTimeout(() => {
                    setMoreToolsOpen(false)
                  }, 200)
                }}
              >
                <ScrollArea className="max-h-[calc(var(--radix-popover-content-available-height)-2px)] [&_[data-radix-scroll-area-viewport]]:max-h-[calc(var(--radix-popover-content-available-height)-2px)]">
                  <div className="p-1.5">
                    {overflowItems.length > 0 && (
                      <div className="border-b border-stone-100 pb-1 mb-1 dark:border-white/10">
                        <div className="px-2 py-1 text-[11px] font-semibold text-stone-400 dark:text-stone-500">工作台</div>
                        {overflowItems.map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={activity === id}
                            onClick={() => openActivity(id)}
                            onMouseEnter={id === "resources" && activity === "resources" ? onResourceEnter : undefined}
                            onMouseLeave={id === "resources" ? onResourceLeave : undefined}
                            className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/[.06]", activity === id && "bg-emerald-50 text-green-700 dark:bg-green-500/15 dark:text-green-400")}
                          >
                            <Icon className="size-4" />
                            {label}
                          </button>
                        ))}
                        {overflowItems.some((item) => item.id === "files") && (
                          <button
                            type="button"
                            disabled={!syncEnabled || syncRunning}
                            onClick={() => {
                              void syncWorkspace()
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-stone-100 disabled:opacity-50 dark:text-stone-300 dark:hover:bg-white/[.06]"
                          >
                            <RefreshCcw className={cn("size-4", syncRunning && "animate-spin")} />
                            {syncRunning ? "正在同步…" : "同步工作区"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            )}
          </div>
        </Popover>}
        <div className="mt-auto flex flex-col items-center gap-1">
          <UpdateBell dark={dark} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-activity-button
                aria-label="切换浅色或深色主题"
                className="size-[38px] rounded-[10px] text-[#a8a29e] hover:!bg-[#f0efed] hover:!text-[#a8a29e]"
                onClick={() => {
                  void window.electronAPI
                    .getSettings()
                    .then(async (settings) => {
                      const theme = document.documentElement.classList.contains("dark") ? "light" : "dark"
                      const saved = await window.electronAPI.saveSettings({ ...settings, theme })
                      applyAppearance(saved)
                      window.dispatchEvent(new Event("vessel:settings-saved"))
                    })
                    .catch((error) => toast.error(String(error)))
                }}
              >
                {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">切换浅色或深色主题</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-activity-button
                aria-label="设置"
                className="size-[38px] rounded-[10px] text-[#a8a29e] hover:!bg-[#f0efed] hover:!text-[#a8a29e]"
                onClick={() => {
                  const from = location.pathname.startsWith("/resources") ? "/resources" : location.hash.slice(1) || location.pathname || "/"
                  sessionStorage.setItem("vessel-settings-from", from)
                  void router.push("/settings")
                }}
              >
                <Settings className="!size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  )
}
