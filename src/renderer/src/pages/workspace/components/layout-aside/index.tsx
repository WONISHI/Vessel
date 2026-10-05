import { ResizableSplit } from "@/components/ui/resizable-split"
import type { ReactNode } from "react"
import { selectLastPinned } from "@/pages/resources/library-state"
import { ProjectLibrary } from "./project-library"
import { Sidebar, useSidebar } from "@/components/ui/sidebar"
import { useRouter } from "@vessel/react-router"
import { useEffect, useRef, useState } from "react"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import LayoutActivityBar from "@/layout/activity-bar"
import LayoutWorkspaceSidebar from "@/pages/workspace/components/layout-aside/layout-workspace-sidebar/index"
import type { AsideActivity } from "@/pages/workspace/components/layout-aside/types"

/** 组合活动栏与侧边列表，统一管理活动选择。 */
export default function LayoutAside({ resources = false, children }: { resources?: boolean; children?: ReactNode }) {
  const { open, setOpen, setOpenMobile, isMobile, width, setWidth } = useSidebar()
  const [preview, setPreview] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(hideTimer.current), [])
  const show = () => { clearTimeout(hideTimer.current); setPreview(true) }
  const hide = () => { clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setPreview(false), 200) }
  const [activity, setActivity] = useState<AsideActivity>("files")
  const { navigateToWorkspaceHome } = useWorkspace()

  const router = useRouter()
  const handleActivityChange = (next: AsideActivity) => {
    if (next === "resources") { selectLastPinned(); setActivity("files"); setPreview(false); void router.push("/resources"); return }
    setPreview(false)
    if (next === "browser") { void router.push("/browser"); return }
    if (next === "todos") { void router.push("/todos"); return }
    if (next === "image") { void router.push("/image"); return }
    if (next === "tools") { void router.push("/devtools"); return }
    setActivity(next)
    if (isMobile) setOpenMobile(true)
    else setOpen(true)
    if (next === "files") { if (resources) void router.push("/editor"); else navigateToWorkspaceHome() }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 bg-white">
      <LayoutActivityBar
        activity={resources ? "resources" : activity}
        onResourceEnter={show}
        onResourceLeave={hide}
        onActivityChange={handleActivityChange}
      />
      {preview && <div onMouseEnter={show} onMouseLeave={hide} className="fixed inset-y-0 left-[52px] z-40 w-[280px] shadow-xl"><ProjectLibrary pinned={resources} onPin={() => setPreview(false)} /></div>}
      {isMobile ? <><Sidebar collapsible="offcanvas"><LayoutWorkspaceSidebar activity={activity} /></Sidebar>{children}</> : <ResizableSplit side="left" size={width} min={232} max={600} label="调整文件侧栏宽度" onResize={setWidth} pane={open ? <div data-sidebar="sidebar" className="flex h-full min-w-0 flex-col bg-white"><LayoutWorkspaceSidebar activity={activity} /></div> : undefined}>{children}</ResizableSplit>}

    </div>
  )
}
