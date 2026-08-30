import { useCallback, useRef } from "react"
import { toast } from "sonner"

export type LogType = "log" | "warn" | "error" | "info"

export interface LogEntry {
  id: string
  type: LogType
  message: any[]
  timestamp: string
}

type ToastId = string | number

const formatArgs = (args: any[]) => {
  return args
    .map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return "[Circular]"
        }
      }

      return String(arg)
    })
    .join(" ")
}

export function useDevToolToast() {
  const activeToastsRef = useRef<Record<string, ToastId>>({})

  /**
   * 显示单条日志 Toast
   */
  const showToast = useCallback((log: LogEntry) => {
    const msg = formatArgs(log.message)

    const Content = () => <div className="max-h-[200px] w-full overflow-y-auto break-all whitespace-pre-wrap text-xs font-mono">{msg}</div>

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

    let toastId: ToastId

    if (log.type === "error") {
      toastId = toast.error(<Content />, {
        ...toastOptions,
        description: "Console Error"
      })
    } else if (log.type === "warn") {
      toastId = toast.warning(<Content />, {
        ...toastOptions,
        description: "Console Warning"
      })
    } else {
      toastId = toast.info(<Content />, {
        ...toastOptions,
        description: `Console ${log.type}`
      })
    }

    activeToastsRef.current[log.id] = toastId
  }, [])

  /**
   * 判断某条日志是否已经存在 Toast
   */
  const hasToast = useCallback((logId: string) => {
    return Boolean(activeToastsRef.current[logId])
  }, [])

  /**
   * 关闭指定 Toast
   */
  const dismissToast = useCallback((logId: string) => {
    const toastId = activeToastsRef.current[logId]

    if (!toastId) return

    toast.dismiss(toastId)
    delete activeToastsRef.current[logId]
  }, [])

  /**
   * 关闭指定类型的 Toast
   */
  const dismissByType = useCallback(
    (logs: LogEntry[], type: LogType) => {
      logs.forEach((log) => {
        if (log.type === type) {
          dismissToast(log.id)
        }
      })
    },
    [dismissToast]
  )

  /**
   * 显示指定类型的历史 Toast
   */
  const showByType = useCallback(
    (logs: LogEntry[], type: LogType) => {
      logs.forEach((log) => {
        if (log.type === type && !hasToast(log.id)) {
          showToast(log)
        }
      })
    },
    [hasToast, showToast]
  )

  /**
   * 关闭所有 Toast
   */
  const dismissAll = useCallback(() => {
    toast.dismiss()
    activeToastsRef.current = {}
  }, [])

  return {
    showToast,
    showByType,
    dismissToast,
    dismissByType,
    dismissAll
  }
}
