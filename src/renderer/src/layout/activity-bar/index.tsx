import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { toast } from "sonner"
import { TransitButton } from "@/components/transit/button"
import { useRouter } from "@vessel/react-router"
import { useLocation } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { selectLastPinned } from "@/pages/resources/library-state"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Sun, Settings, Ellipsis, GitBranch, Send, Wrench, RefreshCcw } from "lucide-react"
import Logo from "@/assets/logo.png"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LayoutActivityBarProps } from "@/layout/activity-bar/types"
import { ACTIVITY_ITEMS } from "@/layout/activity-bar/constants"

/** 左侧窄活动栏：应用入口、活动切换和外观标识。 */
export default function LayoutActivityBar({ activity, onActivityChange, onResourceEnter, onResourceLeave }: LayoutActivityBarProps) {
  const location = useLocation()
  const [moreToolsOpen, setMoreToolsOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMoreToolsActive =
    activity === "tools" ||
    activity === "git" ||
    activity === "postman" ||
    ["/devtools", "/git", "/api-client"].some((p) => location.pathname.startsWith(p))

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
  const syncWorkspace = async () => {
    if (syncPending.current) return
    syncPending.current = true
    setSyncRunning(true)
    window.dispatchEvent(new Event("vessel:sync-status"))
    try {
      const result = await window.electronAPI.runBackup()
      if (result.error) toast.error(result.error)
      else toast.success("工作区同步完成")
    } catch (error) { toast.error(String(error)) }
    finally {
      syncPending.current = false
      setSyncRunning(false)
      window.dispatchEvent(new Event("vessel:sync-status"))
    }
  }
  useEffect(() => {
    let cancelled = false
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
  return (
    <TooltipProvider delayDuration={250}>
      <nav
        aria-label="工作台活动栏"
        className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-[#f0efed] py-2.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="group/logo relative mb-2 block size-[30px]">
              <img
                src={Logo}
                alt=""
                className="pointer-events-none absolute inset-0 size-full object-contain p-0.5 group-hover/logo:opacity-0 group-focus-within/logo:opacity-0"
              />
              <SidebarTrigger
                aria-label={expanded ? "收起侧边栏" : "展开侧边栏"}
                aria-expanded={expanded}
                className="!bg-transparent hover:!bg-stone-100 focus:!bg-transparent !shadow-none size-[30px] rounded-lg text-stone-700 [&>svg]:opacity-0 hover:bg-stone-100 group-hover/logo:[&>svg]:!opacity-100 group-focus-within/logo:[&>svg]:!opacity-100"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="border-stone-200 bg-white text-xs text-stone-700"
          >
            {expanded ? "收起侧边栏" : "展开侧边栏"}
          </TooltipContent>
        </Tooltip>
        {visibleItems.map(({ id, label, icon: Icon }) => (
          <ContextMenu key={id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <ContextMenuTrigger asChild disabled={id !== "files"}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={label}
                  aria-pressed={activity === id}
                  onClick={() => {
                    if (id === "search") { onActivityChange(id); void router.push("/search"); return }
                    if (id === "browser") { onActivityChange(id); void router.push("/browser"); return }
                    if (id === "files") { const last = sessionStorage.getItem("vessel-last-editor-route"); void router.push(last?.startsWith("/editor") ? last : "/editor"); return }
                    if (id === "resources") { selectLastPinned(); onActivityChange(id); void router.push("/resources"); return }
                    if (id === "office") { void router.push("/office"); return }
                    onActivityChange(id)
                  }}
                  onMouseEnter={id === "resources" ? onResourceEnter : undefined}
                  onMouseLeave={id === "resources" ? onResourceLeave : undefined}
                  className={cn(
                    "relative h-[38px] w-[38px] rounded-[10px] text-[#a8a29e] hover:!bg-[#f0efed] hover:!text-[#a8a29e]",
                    activity === id && "!bg-emerald-50 !text-[#16a34a] hover:!bg-emerald-50 hover:!text-[#16a34a]"
                  )}
                >
                  <Icon className="!size-5" />
                  {id === "files" && syncRunning && (
                    <span
                      title="正在同步工作区…"
                      className="pointer-events-none absolute bottom-1 right-1 flex size-3.5 aspect-square shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:bg-stone-900 dark:ring-stone-700"
                    >
                      <RefreshCcw
                        strokeWidth={2.5}
                        className={cn(
                          "!size-2.5 animate-spin",
                          activity === id ? "text-[#16a34a]" : "text-[#a8a29e]"
                        )}
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
            {id === "files" && <ContextMenuContent><ContextMenuItem disabled={!syncEnabled || syncRunning} onSelect={() => { void syncWorkspace() }}><RefreshCcw className={syncRunning ? "animate-spin" : ""} />{syncRunning ? "正在同步…" : "同步"}</ContextMenuItem></ContextMenuContent>}
          </ContextMenu>
        ))}

        <TransitButton />

        {/* 合并工具入口按钮：ellipsis-vertical (SourceTree, Postman, 开发者工具) */}
        <div
          className="relative flex size-[38px] items-center justify-center"
          onMouseEnter={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current)
            setMoreToolsOpen(true)
          }}
          onMouseLeave={() => {
            closeTimer.current = setTimeout(() => setMoreToolsOpen(false), 250)
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="更多开发工具"
                aria-pressed={isMoreToolsActive}
                onClick={() => setMoreToolsOpen((prev) => !prev)}
                className={cn(
                  "relative h-[38px] w-[38px] rounded-[10px] text-stone-500 hover:!bg-[#f0efed] hover:!text-stone-500",
                  (isMoreToolsActive || moreToolsOpen) && "!bg-emerald-50 !text-green-700 hover:!bg-emerald-50 hover:!text-green-700"
                )}
              >
                <Ellipsis className="!size-5" />
              </Button>
            </TooltipTrigger>
            {!moreToolsOpen && (
              <TooltipContent side="right" sideOffset={10} className="border-stone-200 bg-white text-xs text-stone-700">
                更多工具 (Git / API / 开发工具)
              </TooltipContent>
            )}
          </Tooltip>

          {/* 悬停/点击浮层：显示三个合并按钮 */}
          {moreToolsOpen && (
            <div
              className="absolute left-[44px] top-0 z-[300] w-56 rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl transition-all"
              onMouseEnter={() => {
                if (closeTimer.current) clearTimeout(closeTimer.current)
              }}
              onMouseLeave={() => {
                closeTimer.current = setTimeout(() => setMoreToolsOpen(false), 200)
              }}
            >
              <div className="px-2 py-1 text-[11px] font-semibold text-stone-400">开发与接口工具</div>

              {/* 1. Git (代码版本管理) */}
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-stone-100",
                  location.pathname === "/git" && "bg-green-50 text-green-700 font-medium"
                )}
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
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-stone-100",
                  location.pathname === "/api-client" && "bg-green-50 text-green-700 font-medium"
                )}
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
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-stone-100",
                  location.pathname.startsWith("/devtools") && "bg-green-50 text-green-700 font-medium"
                )}
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
          )}
        </div>
        <div className="mt-auto flex flex-col items-center gap-1">
          <span title="外观可在设置中调整" className="flex size-[38px] items-center justify-center text-stone-500"><Sun className="size-5" /></span>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="设置" className="size-[38px] rounded-[10px] text-stone-500 hover:!bg-[#f0efed] hover:!text-stone-500" onClick={() => { const from = location.pathname.startsWith("/resources") ? "/resources" : (location.hash.slice(1) || location.pathname || "/"); sessionStorage.setItem("vessel-settings-from", from); void router.push("/settings") }}><Settings className="!size-5" /></Button></TooltipTrigger><TooltipContent side="right">设置</TooltipContent></Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  )
}
