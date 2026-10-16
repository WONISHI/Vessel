import type { LogType } from "@/components/core/devtool/src/type"

export const LOG_TYPES: LogType[] = ["log", "info", "warn", "error"]

export const DEFAULT_ENABLED_TYPES: Record<LogType, boolean> = {
  log: true,
  warn: true,
  error: true,
  info: true
}
