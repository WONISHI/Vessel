import type { AsideActivity } from "../types"

export interface LayoutActivityBarProps {
  /** 当前选中的活动。 */
  activity: AsideActivity
  /** 用户点击活动入口时通知容器。 */
  onActivityChange: (activity: AsideActivity) => void
}
