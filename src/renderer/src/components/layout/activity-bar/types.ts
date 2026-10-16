import type { AsideActivity } from "@/components/layout/activity-bar/activity"

export interface LayoutActivityBarProps {
  /** 当前选中的活动。 */
  onResourceEnter?: () => void
  onResourceLeave?: () => void
  activity: AsideActivity
  /** 用户点击活动入口时通知容器。 */
  onActivityChange: (activity: AsideActivity) => void
}
