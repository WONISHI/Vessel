import { useState } from "react"
import { useWorkspace } from "../hooks/useWorkspace"
import LayoutActivityBar from "./layout-activity-bar"
import LayoutWorkspaceSidebar from "./layout-workspace-sidebar"
import type { AsideActivity } from "./types"

/** 组合活动栏与侧边列表，统一管理活动选择。 */
export default function LayoutAside() {
  const [activity, setActivity] = useState<AsideActivity>("files")
  const { showHome } = useWorkspace()

  const handleActivityChange = (next: AsideActivity) => {
    setActivity(next)
    if (next === "files") showHome()
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
