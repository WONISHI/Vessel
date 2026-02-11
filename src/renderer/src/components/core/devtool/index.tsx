import React, { useState, useEffect, useRef, useMemo } from "react"
import {
  Cog,
  RefreshCcw,
  FolderSymlink,
  Terminal,
  Ban,
  X,
  type LucideIcon,
  Play,
  Square,
  Trash2,
  Info,
  AlertTriangle,
  AlertCircle,
  FileText,
  CheckCircle2,
  Bug,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { TreeView } from "@/components/ui/tree"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// --- 类型定义 ---
type LogType = "log" | "warn" | "error" | "info"

interface DevToolsItem {
  label: string
  icon: LucideIcon
  action?: () => void
  children?: React.ReactNode
  active?: boolean
  type?: "separator"
}

interface LogEntry {
  id: string
  type: LogType
  message: any[]
  timestamp: string
}

export default function DevTool() {
  const navigate = useNavigate()

  // --- 状态管理 ---
  const [isConsoleOpen, setIsConsoleOpen] = useState(false)

  // 总开关
  const [isSpyEnabled, setIsSpyEnabled] = useState(
    () => localStorage.getItem("vessel-dev-spy") === "true",
  )

  // 子类型开关
  const [enabledTypes, setEnabledTypes] = useState<Record<LogType, boolean>>(
    () => {
      const saved = localStorage.getItem("vessel-dev-spy-types")
      return saved
        ? JSON.parse(saved)
        : { log: true, warn: true, error: true, info: true }
    },
  )

  const [logs, setLogs] = useState<LogEntry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeToastsRef = useRef<Record<string, string | number>>({})

  // 🔴 计算当前是否有错误 (用于控制按钮红色警报)
  const hasError = useMemo(
    () => logs.some((log) => log.type === "error"),
    [logs],
  )

  // --- 拖拽相关 ---
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  )
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const timerRef = useRef<any>(null)

  // --- 辅助函数：显示 Toast ---
  const showToast = (log: LogEntry) => {
    const formatArgs = (args: any[]) => {
      return args
        .map((arg) => {
          if (typeof arg === "object") {
            try {
              return JSON.stringify(arg, null, 2)
            } catch (e) {
              return "[Circular]"
            }
          }
          return String(arg)
        })
        .join(" ")
    }

    const msg = formatArgs(log.message)
    const Content = () => (
      <div className="max-h-[200px] overflow-y-auto w-full text-xs font-mono break-all whitespace-pre-wrap">
        {msg}
      </div>
    )

    const toastOptions = {
      id: log.id,
      duration: Infinity,
      onDismiss: () => {
        delete activeToastsRef.current[log.id]
      },
      cancel: { label: "关闭", onClick: () => {} },
    }

    let toastId
    if (log.type === "error") {
      toastId = toast.error(<Content />, {
        ...toastOptions,
        description: "Console Error",
      })
    } else if (log.type === "warn") {
      toastId = toast.warning(<Content />, {
        ...toastOptions,
        description: "Console Warning",
      })
    } else {
      toastId = toast.info(<Content />, {
        ...toastOptions,
        description: `Console ${log.type}`,
      })
    }

    activeToastsRef.current[log.id] = toastId
  }

  // --- 核心：拦截逻辑 ---
  useEffect(() => {
    if (!isSpyEnabled) return

    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error
    const originalInfo = console.info

    const handleLog = (type: LogType, args: any[]) => {
      const timestamp = new Date().toLocaleTimeString("en-US", {
        hour12: false,
      })
      const id = Math.random().toString(36).substr(2, 9)

      const newLog: LogEntry = { id, type, message: args, timestamp }

      // 1. 存入历史记录
      setLogs((prev) => [...prev, newLog])
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      )

      // 2. 弹窗逻辑
      if (enabledTypes[type]) {
        showToast(newLog)
      }
    }

    console.log = (...args) => {
      originalLog(...args)
      handleLog("log", args)
    }
    console.warn = (...args) => {
      originalWarn(...args)
      handleLog("warn", args)
    }
    console.error = (...args) => {
      originalError(...args)
      handleLog("error", args)
    }
    console.info = (...args) => {
      originalInfo(...args)
      handleLog("info", args)
    }

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
      console.info = originalInfo
    }
  }, [isSpyEnabled, enabledTypes])

  // --- 状态切换处理 ---

  // 切换总开关
  const toggleSpy = () => {
    const newState = !isSpyEnabled

    // 如果开启总开关，但所有子类型都是关闭的，则默认全开，否则可能用户会困惑为什么没反应
    if (newState) {
      const allDisabled = Object.values(enabledTypes).every((v) => !v)
      if (allDisabled) {
        const resetTypes = { log: true, warn: true, error: true, info: true }
        setEnabledTypes(resetTypes)
        localStorage.setItem("vessel-dev-spy-types", JSON.stringify(resetTypes))
        toast.success("Console 监听已开启 (已重置为全部类型)")
      } else {
        toast.success("Console 监听已开启")
      }
    } else {
      toast.dismiss()
      activeToastsRef.current = {}
    }

    setIsSpyEnabled(newState)
    localStorage.setItem("vessel-dev-spy", String(newState))
  }

  // 切换子类型
  const toggleType = (type: LogType) => {
    const isTurningOn = !enabledTypes[type]
    const newTypes = { ...enabledTypes, [type]: isTurningOn }
    setEnabledTypes(newTypes)
    localStorage.setItem("vessel-dev-spy-types", JSON.stringify(newTypes))

    // 🔴 关键逻辑：检查是否所有类型都关闭了
    const allTypesDisabled = Object.values(newTypes).every(
      (enabled) => !enabled,
    )

    if (allTypesDisabled) {
      // 如果所有类型都关了，自动关闭总开关
      setIsSpyEnabled(false)
      localStorage.setItem("vessel-dev-spy", "false")
      toast.dismiss()
      activeToastsRef.current = {}
      toast.info("所有类型已关闭，自动停止监听")
      return
    }

    // 如果开启了任意一个类型，且总开关是关着的，自动开启总开关
    if (isTurningOn && !isSpyEnabled) {
      setIsSpyEnabled(true)
      localStorage.setItem("vessel-dev-spy", "true")
      // 这里不需要 toast，因为下面会有具体的开启提示
    }

    if (isTurningOn) {
      logs.forEach((log) => {
        if (log.type === type && !activeToastsRef.current[log.id]) {
          showToast(log)
        }
      })
      toast.success(`已开启 ${type} 监听，加载历史记录...`)
    } else {
      logs.forEach((log) => {
        if (log.type === type) {
          const toastId = activeToastsRef.current[log.id]
          if (toastId) {
            toast.dismiss(toastId)
            delete activeToastsRef.current[log.id]
          }
        }
      })
      toast.info(`已关闭 ${type} 监听`)
    }
  }

  // --- 拖拽逻辑 ---
  const handleMouseDownCapture = (e: React.MouseEvent) => {
    if (e.button !== 2) return
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    isDraggingRef.current = false
    timerRef.current = setTimeout(() => {
      isDraggingRef.current = true
      toast.info("进入拖拽模式", { duration: 1000 })
    }, 300)

    const handleMouseMove = (ev: MouseEvent) => {
      ev.preventDefault()
      if (isDraggingRef.current) {
        const newX = Math.min(
          Math.max(0, ev.clientX - offsetX),
          window.innerWidth - rect.width,
        )
        const newY = Math.min(
          Math.max(0, ev.clientY - offsetY),
          window.innerHeight - rect.height,
        )
        setPosition({ x: newX, y: newY })
      } else {
        const moveDist = Math.hypot(
          ev.clientX - dragStartRef.current.x,
          ev.clientY - dragStartRef.current.y,
        )
        if (moveDist > 5 && timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
      }
    }

    const handleMouseUp = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      isDraggingRef.current = false
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }

  // --- 菜单配置 ---
  const devTools: DevToolsItem[] = [
    {
      label: isSpyEnabled
        ? "关闭 Console 监听 (总开关)"
        : "开启 Console 监听 (总开关)",
      icon: isSpyEnabled ? Square : Play,
      active: isSpyEnabled,
      action: toggleSpy,
    },
    {
      label: "监听类型设置",
      icon: CheckCircle2,
      children: (
        <div className="w-40">
          <DropdownMenuCheckboxItem
            checked={enabledTypes.log}
            onCheckedChange={() => toggleType("log")}
            className="cursor-pointer"
          >
            <FileText className="mr-2 h-4 w-4 text-blue-500" /> Log
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={enabledTypes.info}
            onCheckedChange={() => toggleType("info")}
            className="cursor-pointer"
          >
            <Info className="mr-2 h-4 w-4 text-cyan-500" /> Info
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={enabledTypes.warn}
            onCheckedChange={() => toggleType("warn")}
            className="cursor-pointer"
          >
            <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" /> Warn
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={enabledTypes.error}
            onCheckedChange={() => toggleType("error")}
            className="cursor-pointer"
          >
            <AlertCircle className="mr-2 h-4 w-4 text-red-500" /> Error
          </DropdownMenuCheckboxItem>
        </div>
      ),
    },
    { type: "separator" } as any,
    {
      label: "清除所有弹窗与记录",
      icon: Trash2,
      action: () => {
        toast.dismiss()
        activeToastsRef.current = {}
        setLogs([])
      },
    },
    {
      label: "打开控制台",
      icon: Bug,
      action: () => {
        window.electronAPI.openDevTool()
      },
    },
    {
      label: "打开历史记录面板",
      icon: Terminal,
      action: () => setIsConsoleOpen(true),
    },
    { type: "separator" } as any,
    {
      label: "刷新页面",
      icon: RefreshCcw,
      action: () => window.location.reload(),
    },
    {
      label: "页面跳转",
      icon: FolderSymlink,
      children: (
        <div className="p-1 min-w-[120px]">
          <TreeView
            data={[
              { name: "首页", path: "/" },
              { name: "编辑器", path: "/editor" },
            ]}
            onSelect={(path) => navigate(path)}
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <div
        className={cn(
          "fixed z-50 transition-shadow",
          !position && "right-4 bottom-4",
        )}
        style={position ? { left: position.x, top: position.y } : undefined}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDownCapture={handleMouseDownCapture}
      >
        {/* 🔴 涟漪效果层：只有当 hasError 为 true 时才显示 */}
        {hasError && (
          <span className="absolute inline-flex h-full w-full rounded-full animate-ping bg-red-400 opacity-75" />
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
                      "h-10 w-10 rounded-full shadow-lg bg-white relative transition-all duration-300",
                      // 🔴 优先级逻辑：
                      // 1. 如果有 Error -> 红色边框 + 红色文字
                      // 2. 如果开启了监听 -> 绿色边框 + 绿色文字
                      // 3. 默认 -> 灰色边框
                      hasError
                        ? "border-red-500 text-red-600 ring-2 ring-red-500 hover:bg-red-50"
                        : isSpyEnabled
                          ? "border-green-500 text-green-600 ring-2 ring-green-500 hover:bg-green-50"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <Cog
                      className={cn(
                        "h-5 w-5 transition-transform duration-500",
                        // 开启时旋转
                        isSpyEnabled && "animate-spin-slow",
                      )}
                    />

                    {/* 🔴 小红点指示器：即使没开涟漪，也显示一个小红点 */}
                    {hasError && (
                      <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-600 border-2 border-white" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>DevTools {hasError ? "(Errors Detected!)" : ""}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenuContent align="end" className="w-64 mb-2">
            <DropdownMenuLabel className="flex justify-between items-center">
              <span>Dev Actions</span>
              {/* 在菜单标题栏显示简报 */}
              {hasError && (
                <span className="text-xs text-red-500 font-bold px-2 py-0.5 bg-red-50 rounded">
                  Errors!
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {devTools.map((item, index) => {
              if ((item as any).type === "separator") {
                return <DropdownMenuSeparator key={index} />
              }
              const Icon = item.icon

              if (item.children) {
                return (
                  <DropdownMenuSub key={index}>
                    <DropdownMenuSubTrigger className="cursor-pointer gap-2">
                      <Icon className="h-4 w-4 text-slate-500" />
                      <span>{item.label}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="p-0">
                      {item.children}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )
              }

              return (
                <DropdownMenuItem
                  key={index}
                  onClick={item.action}
                  className={cn(
                    "cursor-pointer gap-2",
                    item.active &&
                      "bg-green-50 text-green-700 focus:bg-green-100 focus:text-green-800",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      item.active ? "text-green-600" : "text-slate-500",
                    )}
                  />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 历史记录面板 */}
      <Sheet open={isConsoleOpen} onOpenChange={setIsConsoleOpen}>
        <SheetContent
          side="bottom"
          className="h-[40vh] p-0 flex flex-col shadow-2xl border-t border-slate-200 z-[100]"
        >
          <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">
                Console History
              </span>
              <span className="text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {logs.length} events
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs hover:bg-slate-200 text-slate-500"
                // 🔴 清除记录时，也清除了 logs，因此 hasError 会变回 false
                onClick={() => setLogs([])}
              >
                <Ban className="h-3 w-3 mr-1" />
                Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-slate-200"
                onClick={() => setIsConsoleOpen(false)}
              >
                <X className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-slate-50 space-y-1">
            {logs.length === 0 && (
              <div className="text-slate-400 italic text-center py-4">
                No logs recorded in this session...
              </div>
            )}
            {logs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 py-1 px-2 rounded hover:bg-slate-200/50 break-all",
                  log.type === "error" &&
                    "text-red-600 bg-red-50 hover:bg-red-100",
                  log.type === "warn" &&
                    "text-amber-600 bg-amber-50 hover:bg-amber-100",
                  log.type === "info" && "text-blue-600",
                )}
              >
                <span className="text-slate-400 shrink-0 select-none">
                  [{log.timestamp}]
                </span>
                <div className="flex-1 flex gap-2">
                  {log.message.map((msg, j) => (
                    <span key={j} className="whitespace-pre-wrap">
                      {typeof msg === "object"
                        ? JSON.stringify(msg, null, 2)
                        : String(msg)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
