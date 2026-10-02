import { FileSpreadsheet, FolderOpen, Globe, CalendarDays, Home, Wrench, type LucideIcon } from "lucide-react"
import type { AsideActivity } from "./activity"

/** 活动入口配置，id 与侧边栏视图一一对应。 */
export const ACTIVITY_ITEMS = [
  { id: "files", label: "工作区", icon: Home },
  { id: "browser", label: "浏览器", icon: Globe },
  { id: "resources", label: "项目资源库", icon: FolderOpen },
  { id: "office", label: "ONLYOFFICE", icon: FileSpreadsheet },
  { id: "todos", label: "待办", icon: CalendarDays },
  { id: "tools", label: "开发工具", icon: Wrench }
] as const satisfies readonly { id: AsideActivity; label: string; icon: LucideIcon }[]
