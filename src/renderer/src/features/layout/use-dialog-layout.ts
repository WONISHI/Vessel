import { useActivityBarCollapsed } from "@/features/activity-bar/collapse"
import { useStatusBarVisible } from "@/features/status-bar/visibility"

/** Keep nonmodal overlays aligned with the currently available page area. */
export function useDialogLayout(statusBarAccessible = false) {
  const collapsed = useActivityBarCollapsed()
  const statusVisible = useStatusBarVisible()
  const left = collapsed ? 0 : 52
  const bottom = statusBarAccessible && statusVisible ? 32 : 0
  return {
    overlayStyle: { left, bottom },
    contentStyle: { left: `calc(50% + ${left / 2}px)`, width: `calc(100vw - ${left + 32}px)` },
    sheetStyle: { bottom, width: `calc(100vw - ${left}px)` }
  }
}
