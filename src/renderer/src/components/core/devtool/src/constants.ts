import type { LogType } from "./type"

export const LOG_TYPES: LogType[] = ["log", "info", "warn", "error"]

export const DEFAULT_ENABLED_TYPES: Record<LogType, boolean> = {
  log: true,
  warn: true,
  error: true,
  info: true
}
