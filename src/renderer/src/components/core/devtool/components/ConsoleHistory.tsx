import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useEffect, useRef } from "react"
import { Terminal, X, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ConsoleHistoryProps } from "../src/type"

/**
 * 格式化 Console 参数
 */
function formatLogArgs(args: any[]): string {
  return args.map(formatLogValue).join(" ")
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

export function ConsoleHistory({ logs, open, onOpenChange, onClear }: ConsoleHistoryProps) {
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
