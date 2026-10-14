import { TransitButton } from "@/components/transit/button"
import { useRouter } from "@vessel/react-router"
import { useLocation } from "react-router-dom"
import { Fragment, useEffect, useState, useRef } from "react"
import { selectLastPinned } from "@/pages/resources/library-state"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Sun, Settings, EllipsisVertical, GitBranch, Send, Wrench } from "lucide-react"
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
          <Fragment key={id}>
            <Tooltip>
              <TooltipTrigger asChild>
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
                    "relative h-[38px] w-[38px] rounded-[10px] text-stone-500 hover:!bg-[#f0efed] hover:!text-stone-500",
                    activity === id && "!bg-emerald-50 !text-green-700 hover:!bg-emerald-50 hover:!text-green-700"
                  )}
                >
                  <Icon className="!size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={10}
                className="border-stone-200 bg-white text-xs text-stone-700"
              >
                {label}
              </TooltipContent>
            </Tooltip>
          </Fragment>
        ))}

        {/* 合并工具入口按钮：ellipsis-vertical (SourceTree, Postman, 开发者工具) */}
        <div
          className="relative"
          onMouseEnter={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current)
            setMoreToolsOpen(true)
          }}
          onMouseLeave={() => {
            closeTimer.current = setTimeout(() => setMoreToolsOpen(false), 250)
          }}
        >
          <TransitButton />
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
                <EllipsisVertical className="!size-5" />
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

              {/* 1. SourceTree (Git 图形化) */}
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
                  <div className="text-xs font-medium text-stone-800">SourceTree</div>
                  <div className="truncate text-[10px] text-stone-400">Git 图形化版本管理</div>
                </div>
              </button>

              {/* 2. Postman (API 客户端) */}
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
                  <div className="text-xs font-medium text-stone-800">Postman</div>
                  <div className="truncate text-[10px] text-stone-400">API 接口调试与管理</div>
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
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="设置" className="size-[38px] rounded-[10px] text-stone-500 hover:!bg-[#f0efed] hover:!text-stone-500" onClick={() => { sessionStorage.setItem("vessel-settings-from", location.hash.slice(1) || "/"); void router.push("/settings") }}><Settings className="!size-5" /></Button></TooltipTrigger><TooltipContent side="right">设置</TooltipContent></Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  )
}
