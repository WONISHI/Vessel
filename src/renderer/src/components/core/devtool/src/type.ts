import { type DevToolLog } from "../hooks/useDevToolToast"
import { type ConsoleLevel } from "../src/console-manager"
import { type LucideIcon } from "lucide-react"
/**
 *
 * Console History
 *
 */

export interface ConsoleHistoryProps {
  logs: DevToolLog[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onClear: () => void
}

export type LogType = ConsoleLevel

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

export interface DevToolsMenuProps {
  isSpyEnabled: boolean
  enabledTypes: Record<LogType, boolean>
  hasError: boolean
  menuItems: DevToolsMenuItem[]
  onToggleSpy: () => void
  onToggleType: (type: LogType) => void
}
