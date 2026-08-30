import { useCallback, useEffect, useMemo, useState } from "react"
import { Bug, Cog, RefreshCcw, Terminal, Trash2, Wrench } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import ConsoleManager, { type ConsoleRecord, type ConsoleSource } from "./src/console-manager"
import { DevToolsMenu } from "./components/DevToolsMenu"
import { ConsoleHistory } from "./components/ConsoleHistory"
import { useDevToolToast, type DevToolLog } from "./hooks/useDevToolToast"
import { useDraggable } from "./hooks/useDraggable"
import { LOG_TYPES, DEFAULT_ENABLED_TYPES } from "./src/constants"
import type { LogType, DevToolsMenuItem } from "./src/type"

/**
 * Console 类型开关
 */
function readEnabledTypes(): Record<LogType, boolean> {
  const raw = localStorage.getItem("vessel-dev-spy-types")
  if (!raw) {
    return {
      ...DEFAULT_ENABLED_TYPES
    }
  }
  try {
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_ENABLED_TYPES,
      ...parsed
    }
  } catch {
    return {
      ...DEFAULT_ENABLED_TYPES
    }
  }
}

/**
 *
 * @description  DevTool
 *
 */

export default function DevTool() {
  const navigate = useNavigate()
  const [isConsoleOpen, setIsConsoleOpen] = useState(false)
  const [isSpyEnabled, setIsSpyEnabled] = useState(() => {
    return localStorage.getItem("vessel-dev-spy") === "true"
  })
  const [enabledTypes, setEnabledTypes] = useState<Record<LogType, boolean>>(() => readEnabledTypes())
  const [logs, setLogs] = useState<DevToolLog[]>([])
  const { showToast, dismissByType, dismissAll, showEnabledHistory } = useDevToolToast()
  const { position, handleMouseDownCapture } = useDraggable()

  /**
   * 是否存在 Error
   */
  const hasError = useMemo(() => {
    return logs.some((log) => log.type === "error")
  }, [logs])

  /**
   *
   * @description  ConsoleManager -> React
   *
   */

  const handleRecord = useCallback(
    (record: ConsoleRecord) => {
      const log: DevToolLog = {
        id: record.id,
        type: record.type,
        message: record.args,
        timestamp: record.timestamp,
        time: record.time,
        source: record.source
      }
      setLogs((prev) => {
        const next = [...prev, log]
        if (next.length > 1000) {
          return next.slice(next.length - 1000)
        }
        return next
      })
      if (enabledTypes[record.type]) {
        showToast(log)
      }
    },
    [enabledTypes, showToast]
  )

  /**
   *
   * @description  SourceMap / 行号更新
   *
   */

  const handleSourceUpdate = useCallback((id: string, source: ConsoleSource | undefined) => {
    if (!source) {
      return
    }
    setLogs((prev) =>
      prev.map((log) => {
        if (log.id !== id) {
          return log
        }
        return {
          ...log,
          source
        }
      })
    )
  }, [])

  /**
   *
   * @description  安装 ConsoleManager
   *
   */

  useEffect(() => {
    if (!isSpyEnabled) {
      return
    }
    const manager = new ConsoleManager({
      preserveOriginal: true,
      captureSource: true,
      resolveSourceMap: false,
      onLog: handleRecord,
      onSourceUpdate: handleSourceUpdate
    })
    manager.install()
    return () => {
      manager.uninstall()
    }
  }, [handleRecord, handleSourceUpdate, isSpyEnabled])

  /**
   *
   * @description  清除全部日志 + Toast
   *
   */

  const clearAll = useCallback(() => {
    dismissAll()
    setLogs([])
  }, [dismissAll])

  /**
   *
   * @description  总开关
   *
   */

  const toggleSpy = useCallback(() => {
    const nextState = !isSpyEnabled
    if (nextState) {
      const allDisabled = LOG_TYPES.every((type) => {
        return !enabledTypes[type]
      })
      if (allDisabled) {
        const resetTypes = {
          ...DEFAULT_ENABLED_TYPES
        }
        setEnabledTypes(resetTypes)
        localStorage.setItem("vessel-dev-spy-types", JSON.stringify(resetTypes))
        toast.success("Console 监听已开启（已重置为全部类型）")
      } else {
        toast.success("Console 监听已开启")
      }
    } else {
      dismissAll()
    }
    setIsSpyEnabled(nextState)
    localStorage.setItem("vessel-dev-spy", String(nextState))
  }, [dismissAll, enabledTypes, isSpyEnabled])

  /**
   *
   * @description  单独类型开关
   *
   */

  const toggleType = useCallback(
    (type: LogType) => {
      const nextValue = !enabledTypes[type]
      const nextTypes = {
        ...enabledTypes,
        [type]: nextValue
      }
      setEnabledTypes(nextTypes)
      localStorage.setItem("vessel-dev-spy-types", JSON.stringify(nextTypes))
      const allDisabled = LOG_TYPES.every((logType) => {
        return !nextTypes[logType]
      })
      if (allDisabled) {
        setIsSpyEnabled(false)
        localStorage.setItem("vessel-dev-spy", "false")
        dismissAll()
        toast.info("所有类型已关闭，自动停止监听")
        return
      }
      if (nextValue && !isSpyEnabled) {
        setIsSpyEnabled(true)
        localStorage.setItem("vessel-dev-spy", "true")
      }
      if (nextValue) {
        showEnabledHistory(type, logs)
        toast.success(`已开启 ${type} 监听，加载历史记录...`)
        return
      }
      dismissByType(type, logs)
      toast.info(`已关闭 ${type} 监听`)
    },
    [dismissAll, dismissByType, enabledTypes, isSpyEnabled, logs, showEnabledHistory]
  )

  /**
   *
   * @description  打开原生 DevTools
   *
   */

  const openDevTool = useCallback(() => {
    const electronAPI = (
      window as typeof window & {
        electronAPI?: {
          openDevTool?: () => void
        }
      }
    ).electronAPI

    if (electronAPI && electronAPI.openDevTool) {
      electronAPI.openDevTool()
    }
  }, [])

  /**
   *
   * @description  打开历史记录
   *
   */

  const openHistory = useCallback(() => {
    setIsConsoleOpen(true)
  }, [])

  /**
   *
   * @description  刷新页面
   *
   */

  const refreshPage = useCallback(() => {
    window.location.reload()
  }, [])

  /**
   *
   * @description  调试页面
   *
   */

  const navigateDebug = useCallback(() => {
    navigate("/debug")
  }, [navigate])

  /**
   *
   * @description DevTools Menu Buttons
   *
   */

  const menuItems = useMemo<DevToolsMenuItem[]>(
    () => [
      {
        key: "clear",
        label: "清除所有弹窗与记录",
        icon: Trash2,
        onClick: clearAll
      },
      {
        key: "devtools",
        label: "打开控制台",
        icon: Bug,
        onClick: openDevTool
      },
      {
        key: "history",
        label: "打开历史记录面板",
        icon: Terminal,
        onClick: openHistory
      },
      {
        key: "refresh",
        label: "刷新页面",
        icon: RefreshCcw,
        onClick: refreshPage
      },
      {
        key: "debug",
        label: "调试页面",
        icon: Wrench,
        onClick: navigateDebug
      }
    ],
    [clearAll, openDevTool, openHistory, refreshPage, navigateDebug]
  )

  return (
    <>
      <div
        className={cn("fixed z-50 transition-shadow", !position && "bottom-4 right-4", position && "!bottom-auto !right-auto")}
        style={
          position
            ? {
                left: position.x,
                top: position.y
              }
            : undefined
        }
        onContextMenu={(event) => {
          event.preventDefault()
        }}
        onMouseDownCapture={handleMouseDownCapture}
      >
        {hasError && (
          <span
            className="
              pointer-events-none
              absolute
              bottom-0
              right-0
              h-12
              w-12
              animate-ping
              rounded-full
              bg-red-600/30
            "
          />
        )}
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "relative h-12 w-12 rounded-full border bg-white text-stone-600",
                      "outline-none transition-all duration-200",
                      "shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
                      "focus:outline-none",
                      "focus-visible:outline-none",
                      "focus-visible:ring-0",
                      "focus-visible:ring-offset-0",
                      "data-[state=open]:scale-[0.94]",
                      "data-[state=open]:bg-[#f5f5f4]",
                      hasError
                        ? "border-red-500 text-red-600 hover:bg-red-50"
                        : isSpyEnabled
                          ? "border-green-500 text-green-600 hover:bg-green-50 hover:text-green-600"
                          : "border-[#e7e5e4] text-stone-600 hover:bg-[#faf9f7]"
                    )}
                  >
                    <Cog className={cn("!h-7 !w-7 transition-transform duration-500", isSpyEnabled && "animate-[spin_60s_linear_infinite]")} />
                    {hasError && (
                      <span
                        className="
                          pointer-events-none
                          absolute
                          right-0
                          top-0
                          h-3
                          w-3
                          rounded-full
                          border-2
                          border-white
                          bg-red-600
                        "
                      />
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>

              <TooltipContent
                side="left"
                className="text-xs"
              >
                <p>DevTools {hasError ? "(Errors Detected!)" : ""}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DevToolsMenu
            isSpyEnabled={isSpyEnabled}
            enabledTypes={enabledTypes}
            hasError={hasError}
            menuItems={menuItems}
            onToggleSpy={toggleSpy}
            onToggleType={toggleType}
          />
        </DropdownMenu>
      </div>
      <ConsoleHistory
        logs={logs}
        open={isConsoleOpen}
        onOpenChange={setIsConsoleOpen}
        onClear={clearAll}
      />
    </>
  )
}
