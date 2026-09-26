import type { AsideActivity } from "@/pages/workspace/components/layout-aside/types"

export interface LayoutWorkspaceSidebarProps {
  /** 当前活动，决定显示文件树、已打开文件或开发工具列表。 */
  activity: AsideActivity
}
