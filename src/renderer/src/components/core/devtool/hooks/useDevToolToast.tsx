import { useCallback, useEffect, useRef } from "react"

import { toast } from "sonner"

import type { ConsoleLevel, ConsoleSource } from "../src/console-manager"

export interface DevToolLog {
  id: string
  type: ConsoleLevel
  message: any[]
  timestamp: string
  time: string
  source?: ConsoleSource
}

interface UseDevToolToastReturn {
  showToast: (log: DevToolLog) => void

  dismissByType: (type: ConsoleLevel, logs: DevToolLog[]) => void

  dismissAll: () => void

  showEnabledHistory: (type: ConsoleLevel, logs: DevToolLog[]) => void
}

function formatValue(value: any): string {
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

function formatArgs(args: any[]): string {
  return args.map(formatValue).join(" ")
}

export function useDevToolToast(): UseDevToolToastReturn {
  const activeToastsRef = useRef<Record<string, string | number>>({})

  const showToast = useCallback((log: DevToolLog) => {
    const message = formatArgs(log.message)

    const sourceText = log.source && log.source.line ? `${log.source.fileName}:${log.source.line}:${log.source.column}` : ""

    const content = (
      <div className="w-full">
        {sourceText && (
          <div
            className="
                mb-1 truncate
                text-[10px] font-mono
                text-stone-400
              "
          >
            {sourceText}
          </div>
        )}

        <div
          className="
              max-h-[200px] w-full
              overflow-y-auto break-all
              whitespace-pre-wrap
              text-xs font-mono
            "
        >
          {message}
        </div>
      </div>
    )

    const toastOptions = {
      id: log.id,

      duration: Infinity,

      onDismiss: () => {
        delete activeToastsRef.current[log.id]
      },

      cancel: {
        label: "关闭",
        onClick: () => {}
      }
    }

    let toastId: string | number

    if (log.type === "error") {
      toastId = toast.error(content, {
        ...toastOptions,
        description: "Console Error"
      })
    } else if (log.type === "warn") {
      toastId = toast.warning(content, {
        ...toastOptions,
        description: "Console Warning"
      })
    } else {
      toastId = toast.info(content, {
        ...toastOptions,
        description: `Console ${log.type}`
      })
    }

    activeToastsRef.current[log.id] = toastId
  }, [])

  const dismissByType = useCallback((type: ConsoleLevel, logs: DevToolLog[]) => {
    logs.forEach((log) => {
      if (log.type !== type) {
        return
      }

      const toastId = activeToastsRef.current[log.id]

      if (!toastId) {
        return
      }

      toast.dismiss(toastId)

      delete activeToastsRef.current[log.id]
    })
  }, [])

  const dismissAll = useCallback(() => {
    toast.dismiss()
    activeToastsRef.current = {}
  }, [])

  const showEnabledHistory = useCallback(
    (type: ConsoleLevel, logs: DevToolLog[]) => {
      logs.forEach((log) => {
        if (log.type !== type || activeToastsRef.current[log.id]) {
          return
        }

        showToast(log)
      })
    },
    [showToast]
  )

  useEffect(() => {
    return () => {
      toast.dismiss()
      activeToastsRef.current = {}
    }
  }, [])

  return {
    showToast,
    dismissByType,
    dismissAll,
    showEnabledHistory
  }
}

export default useDevToolToast
