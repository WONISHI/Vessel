import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, AlertTriangle, Ban, Bug, CheckCircle2, Cog, FileText, Info, Play, RefreshCcw, Square, Terminal, Trash2, Wrench, X, type LucideIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import ConsoleManager, { type ConsoleLevel, type ConsoleRecord, type ConsoleSource } from "./src/console-manager"
import { useDevToolToast, type DevToolLog } from "./hooks/useDevToolToast"
import { useDraggable } from "./hooks/useDraggable"

type LogType = ConsoleLevel

const LOG_TYPES: LogType[] = ["log", "info", "warn", "error"]

const DEFAULT_ENABLED_TYPES: Record<LogType, boolean> = {
  log: true,
  warn: true,
  error: true,
  info: true
}

const checkboxItemClassName =
  "cursor-pointer rounded-md py-[6px] pr-2 text-[12.5px] text-stone-700 " +
  "focus:bg-[#faf9f7] data-[state=checked]:text-stone-700 " +
  "[&>span:first-child]:h-[14px] " +
  "[&>span:first-child]:w-[14px] " +
  "[&>span:first-child]:rounded-[4px] " +
  "[&>span:first-child]:border " +
  "[&>span:first-child]:border-stone-300 " +
  "data-[state=checked]:[&>span:first-child]:border-green-600 " +
  "data-[state=checked]:[&>span:first-child]:bg-green-600 " +
  "data-[state=checked]:[&>span:first-child]:text-white " +
  "[&>span:first-child_svg]:h-[10px] " +
  "[&>span:first-child_svg]:w-[10px]"

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
 * 格式化单个 Console 参数
 */
function formatLogValue(value: any): string {
  if (value === null || value === undefined) {
    return String(value)
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return "[Circular]"
    }
  }

  return String(value)
}

/**
 * 格式化 Console 参数
 */
function formatLogArgs(args: any[]): string {
  return args.map(formatLogValue).join(" ")
}

/**
 *
 * Console History
 *
 */

interface ConsoleHistoryProps {
  logs: DevToolLog[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onClear: () => void
}

function ConsoleHistory({ logs, open, onOpenChange, onClear }: ConsoleHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const timer = setTimeout(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({
          behavior: "smooth"
        })
      }
    }, 50)

    return () => {
      clearTimeout(timer)
    }
  }, [logs.length, open])

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent
        side="bottom"
        className="
          left-1/2 right-auto z-[100]
          flex h-[328px] w-[calc(100%_-_32px)]
          max-w-[900px] -translate-x-1/2
          flex-col overflow-hidden
          rounded-t-2xl border border-b-0
          border-[#e7e5e4] bg-white p-0
          shadow-[0_20px_60px_rgba(0,0,0,0.12)]
          [&>button.absolute]:hidden
        "
      >
        <div
          className="
            flex items-center justify-between
            border-b border-[#f0efed]
            bg-[#faf9f7]
            px-4 py-[10px]
          "
        >
          <div className="flex items-center gap-[10px]">
            <Terminal className="h-4 w-4 text-stone-500" />

            <span className="text-sm font-bold text-stone-700">Console History</span>

            <span
              className="
                rounded-[5px]
                border border-[#e7e5e4]
                bg-white
                px-2 py-0.5
                text-[11.5px]
                text-stone-500
              "
            >
              {logs.length} events
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={logs.length === 0}
              className="
                h-[26px]
                gap-[5px]
                rounded-md
                px-[10px]
                text-xs
                font-medium
                text-stone-500
                hover:bg-[#f0efed]
                hover:text-stone-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
              onClick={onClear}
            >
              <Ban className="h-[13px] w-[13px]" />
              Clear
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="
                h-[26px]
                w-[26px]
                rounded-md
                p-0
                text-stone-500
                hover:bg-[#f0efed]
                hover:text-stone-700
              "
              onClick={() => {
                onOpenChange(false)
              }}
            >
              <X className="h-[13px] w-[13px]" />
            </Button>
          </div>
        </div>

        <div
          className="
            flex-1
            overflow-y-auto
            bg-[#faf9f7]
            px-4 py-3
            font-mono text-xs
            [scrollbar-color:#e7e5e4_transparent]
            [scrollbar-width:thin]
          "
        >
          {logs.length === 0 && (
            <div
              className="
                py-[30px]
                text-center
                font-sans
                text-[13px]
                italic
                text-stone-400
              "
            >
              No logs recorded in this session...
            </div>
          )}

          {logs.map((log) => {
            const sourceText = log.source && log.source.line ? `${log.source.fileName}:${log.source.line}:${log.source.column}` : ""

            return (
              <div
                key={log.id}
                className={cn(
                  "mb-0.5 rounded-md",
                  "px-2 py-[5px]",
                  "transition-colors",
                  "hover:bg-black/[0.03]",
                  log.type === "error" && "bg-red-50 text-red-700 hover:bg-red-100",
                  log.type === "warn" && "bg-amber-50 text-amber-700 hover:bg-amber-100",
                  log.type === "info" && "text-teal-700"
                )}
              >
                <div className="flex items-start gap-[10px]">
                  <span
                    className="
                      shrink-0
                      select-none
                      text-[11px]
                      text-stone-400
                    "
                  >
                    [{log.time}]
                  </span>

                  {sourceText && (
                    <span
                      className="
                        shrink-0
                        select-none
                        rounded-[4px]
                        bg-white/70
                        px-1
                        text-[10px]
                        text-stone-400
                      "
                      title={log.source ? log.source.raw : undefined}
                    >
                      {sourceText}
                    </span>
                  )}

                  <div
                    className="
                      min-w-0
                      flex-1
                      break-all
                      whitespace-pre-wrap
                    "
                  >
                    {formatLogArgs(log.message)}
                  </div>
                </div>
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 *
 * DevTools Menu Item
 *
 *
 * 注意：
 * 这里保存的是“数据”和“组件类型”，
 * 不保存 DropdownMenuItem ReactNode。
 *
 * 这样可以避免：
 *
 * Cannot access refs during render
 *
 */

interface DevToolsMenuItem {
  key: string
  label: string
  icon: LucideIcon
  onClick: () => void
  iconClassName?: string
}

/**
 *
 * DevTools Menu
 *
 */

interface DevToolsMenuProps {
  isSpyEnabled: boolean
  enabledTypes: Record<LogType, boolean>
  hasError: boolean
  menuItems: DevToolsMenuItem[]
  onToggleSpy: () => void
  onToggleType: (type: LogType) => void
}

function DevToolsMenu({ isSpyEnabled, enabledTypes, hasError, menuItems, onToggleSpy, onToggleType }: DevToolsMenuProps) {
  return (
    <DropdownMenuContent
      align="end"
      sideOffset={8}
      className="
        w-[240px]
        overflow-hidden
        rounded-xl
        border
        border-[#e7e5e4]
        bg-white
        p-0
        shadow-[0_10px_40px_rgba(0,0,0,0.1)]
      "
    >
      <DropdownMenuLabel
        className="
          flex
          items-center
          justify-between
          border-b
          border-[#f0efed]
          px-[12px]
          py-[8px]
        "
      >
        <span
          className="
            text-[11px]
            font-bold
            uppercase
            tracking-[0.5px]
            text-stone-600
          "
        >
          Dev Actions
        </span>

        {hasError && (
          <span
            className="
              rounded-md
              bg-red-50
              px-2
              py-0.5
              text-[10px]
              font-bold
              text-red-600
            "
          >
            Errors!
          </span>
        )}
      </DropdownMenuLabel>

      <DropdownMenuItem
        onClick={onToggleSpy}
        className="
          cursor-pointer
          gap-[8px]
          rounded-none
          px-[12px]
          py-[7px]
          text-[13px]
          text-stone-700
          focus:bg-[#faf9f7]
          focus:text-stone-700
        "
      >
        {isSpyEnabled ? (
          <Square
            className="
              h-[15px]
              w-[15px]
              text-green-600
            "
          />
        ) : (
          <Play
            className="
              h-[15px]
              w-[15px]
              text-stone-500
            "
          />
        )}
        <span>{isSpyEnabled ? "关闭 Console 监听 (总开关)" : "开启 Console 监听 (总开关)"}</span>
      </DropdownMenuItem>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          className="
            cursor-pointer
            gap-[8px]
            rounded-none
            px-[12px]
            py-[7px]
            text-[13px]
            text-stone-700
            focus:bg-[#faf9f7]
            data-[state=open]:bg-[#faf9f7]
          "
        >
          <CheckCircle2
            className="
              h-[15px]
              w-[15px]
              text-stone-500
            "
          />

          <span>监听类型设置</span>
        </DropdownMenuSubTrigger>

        <DropdownMenuSubContent
          className="
            overflow-hidden
            rounded-[10px]
            border
            border-[#e7e5e4]
            bg-white
            p-0
            shadow-[0_8px_30px_rgba(0,0,0,0.1)]
          "
        >
          <div className="w-[170px] p-1">
            <DropdownMenuCheckboxItem
              checked={enabledTypes.log}
              onCheckedChange={() => {
                onToggleType("log")
              }}
              className={checkboxItemClassName}
            >
              <FileText
                className="
                  mr-2
                  h-[14px]
                  w-[14px]
                  text-teal-600
                "
              />
              Log
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={enabledTypes.info}
              onCheckedChange={() => {
                onToggleType("info")
              }}
              className={checkboxItemClassName}
            >
              <Info
                className="
                  mr-2
                  h-[14px]
                  w-[14px]
                  text-cyan-600
                "
              />
              Info
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={enabledTypes.warn}
              onCheckedChange={() => {
                onToggleType("warn")
              }}
              className={checkboxItemClassName}
            >
              <AlertTriangle
                className="
                  mr-2
                  h-[14px]
                  w-[14px]
                  text-amber-600
                "
              />
              Warn
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={enabledTypes.error}
              onCheckedChange={() => {
                onToggleType("error")
              }}
              className={checkboxItemClassName}
            >
              <AlertCircle
                className="
                  mr-2
                  h-[14px]
                  w-[14px]
                  text-red-600
                "
              />
              Error
            </DropdownMenuCheckboxItem>
          </div>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSeparator
        className="
          my-1
          bg-[#f0efed]
        "
      />

      {menuItems.map((item) => {
        const Icon = item.icon

        return (
          <DropdownMenuItem
            key={item.key}
            onClick={item.onClick}
            className="
              cursor-pointer
              gap-[8px]
              rounded-none
              px-[12px]
              py-[7px]
              text-[13px]
              text-stone-700
              focus:bg-[#faf9f7]
              focus:text-stone-700
            "
          >
            <Icon className={cn("h-[15px] w-[15px]", item.iconClassName || "text-stone-500")} />

            <span>{item.label}</span>
          </DropdownMenuItem>
        )
      })}
    </DropdownMenuContent>
  )
}

/**
 *
 * DevTool
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

  /**
   * 保持原来的拖拽 Hook
   */
  const { position, handleMouseDownCapture } = useDraggable()

  /**
   * 是否存在 Error
   */
  const hasError = useMemo(() => {
    return logs.some((log) => log.type === "error")
  }, [logs])

  /**
   *
   * ConsoleManager -> React
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
   * SourceMap / 行号更新
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
   * 安装 ConsoleManager
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
   * 清除全部日志 + Toast
   *
   */

  const clearAll = useCallback(() => {
    dismissAll()
    setLogs([])
  }, [dismissAll])

  /**
   *
   * 总开关
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
   * 单独类型开关
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

      /**
       * 所有类型关闭
       */
      if (allDisabled) {
        setIsSpyEnabled(false)

        localStorage.setItem("vessel-dev-spy", "false")

        dismissAll()

        toast.info("所有类型已关闭，自动停止监听")

        return
      }

      /**
       * 开启某个类型时自动开启总开关
       */
      if (nextValue && !isSpyEnabled) {
        setIsSpyEnabled(true)

        localStorage.setItem("vessel-dev-spy", "true")
      }

      /**
       * 开启类型
       */
      if (nextValue) {
        showEnabledHistory(type, logs)
        toast.success(`已开启 ${type} 监听，加载历史记录...`)

        return
      }

      /**
       * 关闭类型
       */
      dismissByType(type, logs)

      toast.info(`已关闭 ${type} 监听`)
    },
    [dismissAll, dismissByType, enabledTypes, isSpyEnabled, logs, showEnabledHistory]
  )

  /**
   *
   * 打开原生 DevTools
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
   * 打开历史记录
   *
   */

  const openHistory = useCallback(() => {
    setIsConsoleOpen(true)
  }, [])

  /**
   *
   * 刷新页面
   *
   */

  const refreshPage = useCallback(() => {
    window.location.reload()
  }, [])

  /**
   *
   * 调试页面
   *
   */

  const navigateDebug = useCallback(() => {
    navigate("/debug")
  }, [navigate])

  /**
   *
   * DevTools Menu Buttons
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
                          ? "border-green-500 text-green-600 hover:bg-green-50"
                          : "border-[#e7e5e4] text-stone-600 hover:bg-[#faf9f7]"
                    )}
                  >
                    <Cog className={cn("!h-7 !w-7 transition-transform duration-500", isSpyEnabled && "animate-[spin_20s_linear_infinite]")} />
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
