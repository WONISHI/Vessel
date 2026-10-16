import { type DevToolLog } from "@/components/core/devtool/hooks/useDevToolToast"
import { type ConsoleLevel } from "@/components/core/devtool/src/console-manager"
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

export interface DevToolsMenuItem {
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
