import { type CSSProperties } from "react"
import { setActivityBarCollapsed, useActivityBarCollapsed } from "@/features/activity-bar/collapse"
import { setStatusBarVisible, useStatusBarVisible } from "@/features/status-bar/visibility"
import { cn } from "@/lib/utils"
import "@vscode/codicons/dist/codicon.css"
import "./layout-visibility-controls.css"

/** Remains accessible in the title bar when either layout region is hidden. */
export function LayoutVisibilityControls({ activity = true, className }: { activity?: boolean; className?: string }) {
  const activityCollapsed = useActivityBarCollapsed()
  const statusVisible = useStatusBarVisible()
  return <div role="group" aria-label="布局显示" style={{ WebkitAppRegion: "no-drag" } as CSSProperties} className={cn("vessel-layout-controls", className)}>
    {activity && <button type="button" aria-label={activityCollapsed ? "显示活动栏" : "隐藏活动栏"} data-title={activityCollapsed ? "显示活动栏" : "隐藏活动栏"} aria-pressed={!activityCollapsed} onClick={() => setActivityBarCollapsed(!activityCollapsed)}>
      <i aria-hidden="true" className={`codicon codicon-layout-sidebar-left${activityCollapsed ? "-off" : ""}`} />
    </button>}
    <button type="button" aria-label={statusVisible ? "隐藏底部状态栏" : "显示底部状态栏"} data-title={statusVisible ? "隐藏底部状态栏" : "显示底部状态栏"} aria-pressed={statusVisible} onClick={() => setStatusBarVisible(!statusVisible)}>
      <i aria-hidden="true" className={`codicon codicon-layout-panel${statusVisible ? "" : "-off"}`} />
    </button>
  </div>
}
