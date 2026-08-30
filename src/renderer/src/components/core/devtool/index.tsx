import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, AlertTriangle, Ban, Bug, CheckCircle2, Cog, FileText, Info, Play, RefreshCcw, Square, Terminal, Trash2, Wrench, X } from "lucide-react"
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
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useDevToolToast, type LogType, type LogEntry } from "./hooks/useDevToolToast"
import { useDraggable } from "./hooks/useDraggable"

// 复选框样式
const checkboxItemClassName =
  "cursor-pointer rounded-md py-[6px] pr-2 text-[12.5px] text-stone-700 focus:bg-[#faf9f7] data-[state=checked]:text-stone-700 " +
  "[&>span:first-child]:h-[14px] [&>span:first-child]:w-[14px] " +
  "[&>span:first-child]:rounded-[4px] [&>span:first-child]:border [&>span:first-child]:border-stone-300 " +
  "data-[state=checked]:[&>span:first-child]:border-green-600 " +
  "data-[state=checked]:[&>span:first-child]:bg-green-600 " +
  "data-[state=checked]:[&>span:first-child]:text-white " +
  "[&>span:first-child_svg]:h-[10px] [&>span:first-child_svg]:w-[10px]"

export default function DevTool() {
  const navigate = useNavigate()
  const [isConsoleOpen, setIsConsoleOpen] = useState(false)
  const [isSpyEnabled, setIsSpyEnabled] = useState(() => localStorage.getItem("vessel-dev-spy") === "true")
  const [enabledTypes, setEnabledTypes] = useState<Record<LogType, boolean>>(() => {
    const saved = localStorage.getItem("vessel-dev-spy-types")
    return saved ? JSON.parse(saved) : { log: true, warn: true, error: true, info: true }
  })
  const [logs, setLogs] = useState<LogEntry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const { showToast, showByType, dismissByType, dismissAll } = useDevToolToast()
  const hasError = useMemo(() => logs.some((log) => log.type === "error"), [logs])
  const { position, handleMouseDownCapture } = useDraggable({
    onDragStart: () => {
      toast.info("进入拖拽模式", { duration: 1000 })
    }
  })

  useEffect(() => {
    if (!isSpyEnabled) return

    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error
    const originalInfo = console.info

    const handleLog = (type: LogType, args: any[]) => {
      const timestamp = new Date().toLocaleTimeString("en-US", {
        hour12: false
      })
      const id = Math.random().toString(36).substr(2, 9)
      const newLog: LogEntry = {
        id,
        type,
        message: args,
        timestamp
      }

      setLogs((prev) => [...prev, newLog])

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({
          behavior: "smooth"
        })
      }, 50)

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
  }, [enabledTypes, isSpyEnabled, showToast])

  // --- 切换总开关 ---
  const toggleSpy = () => {
    const newState = !isSpyEnabled

    if (newState) {
      const allDisabled = Object.values(enabledTypes).every((enabled) => !enabled)

      if (allDisabled) {
        const resetTypes = {
          log: true,
          warn: true,
          error: true,
          info: true
        }

        setEnabledTypes(resetTypes)
        localStorage.setItem("vessel-dev-spy-types", JSON.stringify(resetTypes))
        toast.success("Console 监听已开启 (已重置为全部类型)")
      } else {
        toast.success("Console 监听已开启")
      }
    } else {
      dismissAll()
    }

    setIsSpyEnabled(newState)
    localStorage.setItem("vessel-dev-spy", String(newState))
  }

  // --- 切换子类型 ---
  const toggleType = (type: LogType) => {
    const isTurningOn = !enabledTypes[type]
    const newTypes = {
      ...enabledTypes,
      [type]: isTurningOn
    }

    setEnabledTypes(newTypes)
    localStorage.setItem("vessel-dev-spy-types", JSON.stringify(newTypes))

    const allTypesDisabled = Object.values(newTypes).every((enabled) => !enabled)

    if (allTypesDisabled) {
      setIsSpyEnabled(false)
      localStorage.setItem("vessel-dev-spy", "false")
      dismissAll()
      toast.info("所有类型已关闭，自动停止监听")
      return
    }

    if (isTurningOn && !isSpyEnabled) {
      setIsSpyEnabled(true)
      localStorage.setItem("vessel-dev-spy", "true")
    }

    if (isTurningOn) {
      showByType(logs, type)
      toast.success(`已开启 ${type} 监听，加载历史记录...`)
      return
    }

    dismissByType(logs, type)
    toast.info(`已关闭 ${type} 监听`)
  }

  // --- 清除记录 ---
  const clearLogs = () => {
    dismissAll()
    setLogs([])
  }

  return (
    <>
      {/* ========== 悬浮按钮 ========== */}
      <div
        className={cn("fixed bottom-4 right-4 z-50", position && "!bottom-auto !right-auto")}
        style={position ? { left: position.x, top: position.y } : undefined}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDownCapture={handleMouseDownCapture}
      >
        {hasError && <span className="pointer-events-none absolute inset-0 h-12 w-12 animate-ping rounded-full bg-red-600/30" />}

        <div className="group relative">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "relative flex h-12 w-12 items-center justify-center rounded-full border bg-white",
                "outline-none transition-all duration-200",
                "focus:outline-none focus-visible:outline-none focus-visible:ring-0",
                "shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
                "hover:-translate-y-[1px] hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]",
                "data-[state=open]:scale-[0.94]",
                hasError
                  ? "border-red-500 text-red-600 hover:border-red-600 hover:bg-red-50 hover:text-red-600 hover:shadow-[0_0_0_3px_rgba(220,38,38,0.14),0_6px_16px_rgba(0,0,0,0.1)]"
                  : isSpyEnabled
                    ? "border-green-500 text-green-600 hover:border-green-600 hover:bg-green-50 hover:text-green-600 hover:shadow-[0_0_0_3px_rgba(22,163,74,0.14),0_6px_16px_rgba(0,0,0,0.1)]"
                    : "border-[#e7e5e4] text-stone-600 hover:bg-[#faf9f7] hover:text-stone-700"
              )}
            >
              <Cog className={cn("!h-7 !w-7 transition-transform", isSpyEnabled && "animate-[spin_20s_linear_infinite]")} />

              {hasError && <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-red-600" />}
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-[240px] overflow-hidden rounded-xl border border-[#e7e5e4] bg-white p-0 shadow-[0_10px_40px_rgba(0,0,0,0.1)]"
            >
              <DropdownMenuLabel className="flex items-center justify-between border-b border-[#f0efed] px-[12px] py-[8px]">
                <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-stone-600">Dev Actions</span>

                {hasError && <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Errors!</span>}
              </DropdownMenuLabel>

              <DropdownMenuItem
                onClick={toggleSpy}
                className={cn(
                  "cursor-pointer gap-[8px] rounded-none px-[12px] py-[7px] text-[13px] text-stone-700 focus:bg-[#faf9f7] focus:text-stone-700",
                  isSpyEnabled && "bg-green-50 text-green-700 focus:bg-green-100 focus:text-green-800"
                )}
              >
                {isSpyEnabled ? <Square className="h-[15px] w-[15px] text-green-600" /> : <Play className="h-[15px] w-[15px] text-stone-500" />}
                <span>{isSpyEnabled ? "关闭 Console 监听 (总开关)" : "开启 Console 监听 (总开关)"}</span>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer gap-[8px] rounded-none px-[12px] py-[7px] text-[13px] text-stone-700 focus:bg-[#faf9f7] data-[state=open]:bg-[#faf9f7]">
                  <CheckCircle2 className="h-[15px] w-[15px] text-stone-500" />
                  <span>监听类型设置</span>
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="overflow-hidden rounded-[10px] border border-[#e7e5e4] bg-white p-0 shadow-[0_8px_30px_rgba(0,0,0,0.1)]">
                  <div className="w-[170px] p-1">
                    <DropdownMenuCheckboxItem
                      checked={enabledTypes.log}
                      onCheckedChange={() => toggleType("log")}
                      className={checkboxItemClassName}
                    >
                      <FileText className="mr-2 h-[14px] w-[14px] text-teal-600" />
                      Log
                    </DropdownMenuCheckboxItem>

                    <DropdownMenuCheckboxItem
                      checked={enabledTypes.info}
                      onCheckedChange={() => toggleType("info")}
                      className={checkboxItemClassName}
                    >
                      <Info className="mr-2 h-[14px] w-[14px] text-cyan-600" />
                      Info
                    </DropdownMenuCheckboxItem>

                    <DropdownMenuCheckboxItem
                      checked={enabledTypes.warn}
                      onCheckedChange={() => toggleType("warn")}
                      className={checkboxItemClassName}
                    >
                      <AlertTriangle className="mr-2 h-[14px] w-[14px] text-amber-600" />
                      Warn
                    </DropdownMenuCheckboxItem>

                    <DropdownMenuCheckboxItem
                      checked={enabledTypes.error}
                      onCheckedChange={() => toggleType("error")}
                      className={checkboxItemClassName}
                    >
                      <AlertCircle className="mr-2 h-[14px] w-[14px] text-red-600" />
                      Error
                    </DropdownMenuCheckboxItem>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator className="my-1 bg-[#f0efed]" />

              <DropdownMenuItem
                onClick={clearLogs}
                className="cursor-pointer gap-[8px] rounded-none px-[12px] py-[7px] text-[13px] text-stone-700 focus:bg-[#faf9f7] focus:text-stone-700"
              >
                <Trash2 className="h-[15px] w-[15px] text-stone-500" />
                <span>清除所有弹窗与记录</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  ;(window.electronAPI as any).openDevTool()
                }}
                className="cursor-pointer gap-[8px] rounded-none px-[12px] py-[7px] text-[13px] text-stone-700 focus:bg-[#faf9f7] focus:text-stone-700"
              >
                <Bug className="h-[15px] w-[15px] text-stone-500" />
                <span>打开控制台</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setIsConsoleOpen(true)}
                className="cursor-pointer gap-[8px] rounded-none px-[12px] py-[7px] text-[13px] text-stone-700 focus:bg-[#faf9f7] focus:text-stone-700"
              >
                <Terminal className="h-[15px] w-[15px] text-stone-500" />
                <span>打开历史记录面板</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-[#f0efed]" />

              <DropdownMenuItem
                onClick={() => window.location.reload()}
                className="cursor-pointer gap-[8px] rounded-none px-[12px] py-[7px] text-[13px] text-stone-700 focus:bg-[#faf9f7] focus:text-stone-700"
              >
                <RefreshCcw className="h-[15px] w-[15px] text-stone-500" />
                <span>刷新页面</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate("/debug")}
                className="cursor-pointer gap-[8px] rounded-none px-[12px] py-[7px] text-[13px] text-stone-700 focus:bg-[#faf9f7] focus:text-stone-700"
              >
                <Wrench className="h-[15px] w-[15px] text-stone-500" />
                <span>调试页面</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span
            className={cn(
              "pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md",
              "border border-[#e7e5e4] bg-white px-2.5 py-1 text-xs text-stone-700",
              "shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
              "opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            )}
          >
            DevTools {hasError ? "(Errors Detected!)" : ""}
          </span>
        </div>
      </div>

      {/* ========== 历史记录面板 ========== */}
      <Sheet
        open={isConsoleOpen}
        onOpenChange={setIsConsoleOpen}
      >
        <SheetContent
          side="bottom"
          className="left-1/2 right-auto z-[100] flex h-[328px] w-[calc(100%_-_32px)] max-w-[900px] -translate-x-1/2 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-[#e7e5e4] bg-white p-0 shadow-[0_20px_60px_rgba(0,0,0,0.12)] [&>button.absolute]:hidden"
        >
          <div className="flex items-center justify-between border-b border-[#f0efed] bg-[#faf9f7] px-4 py-[10px]">
            <div className="flex items-center gap-[10px]">
              <Terminal className="h-4 w-4 text-stone-500" />
              <span className="text-sm font-bold text-stone-700">Console History</span>
              <span className="rounded-[5px] border border-[#e7e5e4] bg-white px-2 py-0.5 text-[11.5px] text-stone-500">{logs.length} events</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={logs.length === 0}
                className="h-[26px] gap-[5px] rounded-md px-[10px] text-xs font-medium text-stone-500 hover:bg-[#f0efed] hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={clearLogs}
              >
                <Ban className="h-[13px] w-[13px]" />
                Clear
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-[26px] w-[26px] rounded-md p-0 text-stone-500 outline-none hover:bg-[#f0efed] hover:text-stone-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                onClick={() => setIsConsoleOpen(false)}
              >
                <X className="h-[13px] w-[13px]" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#faf9f7] px-4 py-3 font-mono text-xs [scrollbar-color:#e7e5e4_transparent] [scrollbar-width:thin]">
            {logs.length === 0 && <div className="py-[30px] text-center font-sans text-[13px] italic text-stone-400">No logs recorded in this session...</div>}

            {logs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  "mb-0.5 flex items-start gap-[10px] rounded-md px-2 py-[5px] text-stone-700 transition-colors hover:bg-black/[0.03]",
                  log.type === "error" && "bg-red-50 text-red-700 hover:bg-red-100",
                  log.type === "warn" && "bg-amber-50 text-amber-700 hover:bg-amber-100",
                  log.type === "info" && "text-teal-700"
                )}
              >
                <span className="shrink-0 select-none text-[11px] text-stone-400">[{log.timestamp}]</span>

                <div className="flex flex-1 gap-2 break-all">
                  {log.message.map((msg, index) => (
                    <span
                      key={index}
                      className="whitespace-pre-wrap break-all"
                    >
                      {typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg)}
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
