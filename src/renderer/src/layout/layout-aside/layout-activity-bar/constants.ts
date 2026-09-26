import { CalendarDays, Home, Wrench, type LucideIcon } from "lucide-react"
import type { AsideActivity } from "../types"

/** 活动入口配置，id 与侧边栏视图一一对应。 */
export const ACTIVITY_ITEMS = [
  { id: "files", label: "工作区", icon: Home },
  { id: "recent", label: "本次打开", icon: CalendarDays },
  { id: "tools", label: "开发工具", icon: Wrench }
] as const satisfies readonly { id: AsideActivity; label: string; icon: LucideIcon }[]
