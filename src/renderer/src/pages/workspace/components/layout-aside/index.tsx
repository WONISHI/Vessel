import { useState } from "react"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import LayoutActivityBar from "@/pages/workspace/components/layout-aside/layout-activity-bar/index"
import LayoutWorkspaceSidebar from "@/pages/workspace/components/layout-aside/layout-workspace-sidebar/index"
import type { AsideActivity } from "@/pages/workspace/components/layout-aside/types"

/** 组合活动栏与侧边列表，统一管理活动选择。 */
export default function LayoutAside() {
  const [activity, setActivity] = useState<AsideActivity>("files")
  const { navigateToWorkspaceHome } = useWorkspace()

  const handleActivityChange = (next: AsideActivity) => {
    setActivity(next)
    if (next === "files") navigateToWorkspaceHome()
  }

  return (
    <aside className="flex h-full shrink-0 bg-[#faf9f7]">
      <LayoutActivityBar
        activity={activity}
        onActivityChange={handleActivityChange}
      />
      <LayoutWorkspaceSidebar activity={activity} />
    </aside>
  )
}
