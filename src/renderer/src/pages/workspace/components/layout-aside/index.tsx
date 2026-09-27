import { Sidebar, useSidebar } from "@/components/ui/sidebar"
import { useRouter } from "@vessel/react-router"
import { useState } from "react"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import LayoutActivityBar from "@/layout/activity-bar"
import LayoutWorkspaceSidebar from "@/pages/workspace/components/layout-aside/layout-workspace-sidebar/index"
import type { AsideActivity } from "@/pages/workspace/components/layout-aside/types"

/** 组合活动栏与侧边列表，统一管理活动选择。 */
export default function LayoutAside() {
  const { setOpen, setOpenMobile, isMobile } = useSidebar()
  const [activity, setActivity] = useState<AsideActivity>("files")
  const { navigateToWorkspaceHome } = useWorkspace()

  const router = useRouter()
  const handleActivityChange = (next: AsideActivity) => {
    if (next === "todos") { void router.push("/todos"); return }
    setActivity(next)
    if (isMobile) setOpenMobile(true)
    else setOpen(true)
    if (next === "files") navigateToWorkspaceHome()
  }

  return (
    <aside className="flex h-full shrink-0 bg-white">
      <LayoutActivityBar
        activity={activity}
        onActivityChange={handleActivityChange}
      />
      <Sidebar
        collapsible="offcanvas"
        className="left-[52px] bg-white [&_[data-sidebar=sidebar]]:bg-white"
      >
        <LayoutWorkspaceSidebar activity={activity} />
      </Sidebar>
    </aside>
  )
}
