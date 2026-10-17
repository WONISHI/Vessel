import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { applyAppearance } from "@/pages/settings/appearance"
import { useActivityOverflow } from "@/components/layout/activity-bar/use-activity-overflow"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import Logo from "@/assets/logo.png"
import { ACTIVITY_ITEMS } from "@/components/layout/activity-bar/constants"
import type { LayoutActivityBarProps } from "@/components/layout/activity-bar/types"
import { TransitButton } from "@/components/transit/button"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { selectLastPinned } from "@/pages/resources/library-state"
import { useRouter } from "@vessel/react-router"
import { Ellipsis, GitBranch, RefreshCcw, Send, Settings, Sun, Moon, Wrench } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"

/** 左侧窄活动栏：应用入口、活动切换和外观标识。 */
export default function LayoutActivityBar({ activity, onActivityChange, onResourceEnter, onResourceLeave }: LayoutActivityBarProps) {
  const dark = useDarkAppearance()
  const location = useLocation()
  const [moreToolsOpen, setMoreToolsOpen] = useState(false)
  const transitOpen = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMoreToolsActive = activity === "tools" || activity === "git" || activity === "postman" || ["/devtools", "/git", "/api-client"].some((p) => location.pathname.startsWith(p))

  useEffect(() => {
    if (location.pathname === "/editor" || location.pathname.startsWith("/editor/")) sessionStorage.setItem("vessel-last-editor-route", location.pathname + location.search)
  }, [location.pathname, location.search])
  const router = useRouter()
  const { open, openMobile, isMobile } = useSidebar()
  const expanded = isMobile ? openMobile : open
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
        .catch(() => {})
    }
    checkSync()
    window.addEventListener("vessel:sync-context", checkSync)
    window.addEventListener("vessel:settings-saved", checkSync)
    window.addEventListener("vessel:sync-status", checkSync)
    const interval = setInterval(checkSync, 3000)
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
          if (!cancelled) setGlobalSearchEnabled(!!s.globalSearchEnabled)
        })
        .catch(() => {})
    }
    update()
    window.addEventListener("vessel:settings-saved", update)
    return () => {
      cancelled = true
      window.removeEventListener("vessel:settings-saved", update)
    }
  }, [])
  const visibleItems = ACTIVITY_ITEMS.filter((item) => item.id !== "search" || globalSearchEnabled)
  const { railRef, capacity } = useActivityOverflow(visibleItems.length + 1)
  const priorityItems = [...visibleItems].sort((a, b) => {
    /** Keeps the workspace and current activity ahead of secondary entries when space is limited. */
    const priority = (id: string) => (id === "files" ? 0 : id === activity ? 1 : 2)
    return priority(a.id) - priority(b.id)
  })
  const shownIds = new Set(priorityItems.slice(0, capacity).map((item) => item.id))
  const shownItems = visibleItems.filter((item) => shownIds.has(item.id))
  const overflowItems = visibleItems.filter((item) => !shownIds.has(item.id))
  const showTransit = capacity > visibleItems.length
  const moreActive = isMoreToolsActive || overflowItems.some((item) => item.id === activity)

  /** Opens an activity through the same navigation path in the rail and overflow menu. */
  const openActivity = (id: (typeof visibleItems)[number]["id"]) => {
    setMoreToolsOpen(false)
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
                src={Logo}
                alt=""
                className={cn("pointer-events-none absolute inset-0 size-full object-contain p-0.5", activity !== "browser" && activity !== "office" && "group-hover/logo:opacity-0 group-focus-within/logo:opacity-0")}
              />
              {activity !== "browser" && activity !== "office" ? (
                <SidebarTrigger
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
                    onMouseEnter={id === "resources" ? onResourceEnter : undefined}
                    onMouseLeave={id === "resources" ? onResourceLeave : undefined}
                    className={cn("relative h-[38px] w-[38px] rounded-[10px] text-[#a8a29e] hover:!bg-[#f0efed] hover:!text-[#a8a29e]", activity === id && "!bg-emerald-50 !text-[#16a34a] hover:!bg-emerald-50 hover:!text-[#16a34a]")}
                  >
                    <Icon className="!size-5" />
                    {id === "files" && syncRunning && (
                      <span
                        title="正在同步工作区…"
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

        {showTransit && <TransitButton />}

        {/* 合并工具入口按钮：ellipsis-vertical (SourceTree, Postman, 开发者工具) */}
        <Popover
          open={moreToolsOpen}
          onOpenChange={setMoreToolsOpen}
        >
          <div
            className="relative flex size-[38px] items-center justify-center"
            onMouseEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current)
              setMoreToolsOpen(true)
            }}
            onMouseLeave={() => {
              closeTimer.current = setTimeout(() => {
                if (!transitOpen.current) setMoreToolsOpen(false)
              }, 250)
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-activity-button
                    aria-label="更多开发工具"
                    aria-pressed={moreActive}
                    className={cn("relative h-[38px] w-[38px] rounded-[10px] text-stone-500 hover:!bg-[#f0efed] hover:!text-stone-500", (moreActive || moreToolsOpen) && "!bg-emerald-50 !text-green-700 hover:!bg-emerald-50 hover:!text-green-700")}
                  >
                    <Ellipsis className="!size-5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              {!moreToolsOpen && (
                <TooltipContent
                  side="right"
                  sideOffset={10}
                  className="border-stone-200 bg-white text-xs text-stone-700"
                >
                  更多工具 (Git / API / 开发工具)
                </TooltipContent>
              )}
            </Tooltip>

            {/* 悬停/点击浮层：显示三个合并按钮 */}
            {moreToolsOpen && (
              <PopoverContent
                side="right"
                align="end"
                sideOffset={6}
                collisionPadding={8}
                onOpenAutoFocus={(event) => event.preventDefault()}
                className="z-[300] max-h-[var(--radix-popover-content-available-height)] w-56 overflow-hidden rounded-xl border border-stone-200 bg-white p-0 shadow-xl"
                onMouseEnter={() => {
                  if (closeTimer.current) clearTimeout(closeTimer.current)
                }}
                onMouseLeave={() => {
                  closeTimer.current = setTimeout(() => {
                    if (!transitOpen.current) setMoreToolsOpen(false)
                  }, 200)
                }}
              >
                <ScrollArea className="max-h-[calc(var(--radix-popover-content-available-height)-2px)] [&_[data-radix-scroll-area-viewport]]:max-h-[calc(var(--radix-popover-content-available-height)-2px)]">
                  <div className="p-1.5">
                    {(overflowItems.length > 0 || !showTransit) && (
                      <div className="border-b border-stone-100 pb-1 mb-1">
                        <div className="px-2 py-1 text-[11px] font-semibold text-stone-400">工作台</div>
                        {overflowItems.map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={activity === id}
                            onClick={() => openActivity(id)}
                            onMouseEnter={id === "resources" ? onResourceEnter : undefined}
                            onMouseLeave={id === "resources" ? onResourceLeave : undefined}
                            className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-stone-100", activity === id && "bg-emerald-50 text-green-700")}
                          >
                            <Icon className="size-4" />
                            {label}
                          </button>
                        ))}
                        {!showTransit && (
                          <TransitButton
                            menuItem
                            onOpenChange={(open) => {
                              transitOpen.current = open
                              if (open && closeTimer.current) clearTimeout(closeTimer.current)
                            }}
                          />
                        )}
                        {overflowItems.some((item) => item.id === "files") && (
                          <button
                            type="button"
                            disabled={!syncEnabled || syncRunning}
                            onClick={() => {
                              void syncWorkspace()
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-stone-100 disabled:opacity-50"
                          >
                            <RefreshCcw className={cn("size-4", syncRunning && "animate-spin")} />
                            {syncRunning ? "正在同步…" : "同步工作区"}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="px-2 py-1 text-[11px] font-semibold text-stone-400">开发与接口工具</div>

                    {/* 1. Git (代码版本管理) */}
                    <button
                      type="button"
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-stone-100", location.pathname === "/git" && "bg-green-50 text-green-700 font-medium")}
                      onClick={() => {
                        setMoreToolsOpen(false)
                        onActivityChange("git")
                        void router.push("/git")
                      }}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-orange-50 text-orange-600">
                        <GitBranch className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-stone-800">Git</div>
                        <div className="truncate text-[10px] text-stone-400">代码版本管理与分支</div>
                      </div>
                    </button>

                    {/* 2. API (接口调试与管理) */}
                    <button
                      type="button"
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-stone-100", location.pathname === "/api-client" && "bg-green-50 text-green-700 font-medium")}
                      onClick={() => {
                        setMoreToolsOpen(false)
                        onActivityChange("postman")
                        void router.push("/api-client")
                      }}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                        <Send className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-stone-800">API</div>
                        <div className="truncate text-[10px] text-stone-400">接口调试与请求管理</div>
                      </div>
                    </button>

                    {/* 3. 开发者工具 (DevTools) */}
                    <button
                      type="button"
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-stone-100", location.pathname.startsWith("/devtools") && "bg-green-50 text-green-700 font-medium")}
                      onClick={() => {
                        setMoreToolsOpen(false)
                        onActivityChange("tools")
                        void router.push("/devtools")
                      }}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                        <Wrench className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-stone-800">开发工具</div>
                        <div className="truncate text-[10px] text-stone-400">Console / 存储 / 调试工具</div>
                      </div>
                    </button>
                  </div>
                </ScrollArea>
              </PopoverContent>
            )}
          </div>
        </Popover>
        <div className="mt-auto flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="切换浅色或深色主题"
            title="切换浅色或深色主题"
            className="size-[38px] text-stone-500"
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="设置"
                className="size-[38px] rounded-[10px] text-stone-500 hover:!bg-[#f0efed] hover:!text-stone-500"
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
