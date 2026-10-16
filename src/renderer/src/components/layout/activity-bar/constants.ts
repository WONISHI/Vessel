import type { AsideActivity } from "@/components/layout/activity-bar/activity"
import { CalendarDays, FileSpreadsheet, FolderOpen, Globe, Home, ImageIcon, Search, type LucideIcon } from "lucide-react"

/** 活动入口配置，id 与侧边栏视图一一对应。 */
export const ACTIVITY_ITEMS = [
  { id: "files", label: "工作区", icon: Home },
  { id: "search", label: "全局搜索", icon: Search },
  { id: "browser", label: "浏览器", icon: Globe },
  { id: "resources", label: "项目资源库", icon: FolderOpen },
  { id: "office", label: "ONLYOFFICE", icon: FileSpreadsheet },
  { id: "todos", label: "待办", icon: CalendarDays },
  { id: "image", label: "图片", icon: ImageIcon }
] as const satisfies readonly { id: AsideActivity; label: string; icon: LucideIcon }[]
