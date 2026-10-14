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
import { SearchPanel } from "@/pages/search"
import type { ContentMatch } from "../../../../../../shared/content-search"
import type { WorkspaceNode } from "@/pages/workspace/types/workspace"
import { codeEditors } from "@/components/core/canvas/variants/code/search-bridge"

/** 文件打开后定位搜索命中：Markdown 高亮所在块，代码编辑器选中关键词。编辑器异步挂载，故短暂轮询。 */
function revealSearchHit(match: ContentMatch) {
  const range = match.ranges[0]
  const keyword = range ? match.text.slice(range.start, range.end) : match.text.trim()
  const lower = keyword.toLowerCase()
  let tries = 0
  const attempt = () => {
    const code = codeEditors.get(match.path)
    if (code) {
      const column = (range?.start ?? 0) + 1
      code.revealLineInCenter(match.line)
      code.setPosition({ lineNumber: match.line, column }); code.focus()
      return
    }
    const editor = [...document.querySelectorAll<HTMLElement>(".vditor-ir .vditor-reset")].find(node => node.getClientRects().length)
    const block = editor && [...editor.querySelectorAll<HTMLElement>("p,h1,h2,h3,h4,h5,h6,li,td,th,pre")].find(node => !node.querySelector("p,li,pre") && (node.innerText || "").toLowerCase().includes(lower))
    if (block) {
      block.scrollIntoView({ behavior: "smooth", block: "center" })
      block.animate?.([{ backgroundColor: "#bbf7d0" }, { backgroundColor: "#bbf7d0", offset: .7 }, { backgroundColor: "transparent" }], { duration: 2400 })
      return
    }
    if (++tries < 30) setTimeout(attempt, 100)
  }
  setTimeout(attempt, 50)
}

/** 组合活动栏与侧边列表，统一管理活动选择。 */
export default function LayoutAside({ resources = false, children }: { resources?: boolean; children?: ReactNode }) {
  const { open, setOpen, setOpenMobile, isMobile, width, setWidth } = useSidebar()
  const [preview, setPreview] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(hideTimer.current), [])
  const show = () => { clearTimeout(hideTimer.current); setPreview(true) }
  const hide = () => { clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setPreview(false), 200) }
  const [activity, setActivity] = useState<AsideActivity>("files")
  const [searching, setSearching] = useState(() => sessionStorage.getItem("vessel-open-search") === "1")
  const [searchHit, setSearchHit] = useState<ContentMatch | null>(null)
  useEffect(() => { sessionStorage.removeItem("vessel-open-search") }, [])
  const { navigateToWorkspaceHome, openWorkspaceFile } = useWorkspace()

  const router = useRouter()
  const handleActivityChange = (next: AsideActivity) => {
    if (next === "search") { setSearching(value => !value); return }
    setSearching(false)
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
  const searchPane = <div className="vessel-search-sheet h-full min-w-0 bg-white"><SearchPanel selected={searchHit} onClose={() => setSearching(false)} onSelect={match => { setSearchHit(match); openWorkspaceFile({ name: match.path.split(/[\\/]/).pop() || match.path, path: match.path, type: "file" } as WorkspaceNode); revealSearchHit(match) }} /></div>

  return (
    <div className="flex h-full min-w-0 flex-1 bg-white">
      <LayoutActivityBar
        activity={searching ? "search" : resources ? "resources" : activity}
        onResourceEnter={show}
        onResourceLeave={hide}
        onActivityChange={handleActivityChange}
      />
      {preview && <div onMouseEnter={show} onMouseLeave={hide} className="fixed inset-y-0 left-[52px] z-40 w-[280px] shadow-xl"><ProjectLibrary pinned={resources} onPin={() => setPreview(false)} /></div>}
      {isMobile ? <><Sidebar collapsible="offcanvas"><LayoutWorkspaceSidebar activity={activity} /></Sidebar>{children}</> : <ResizableSplit side="left" size={width} min={232} max={600} label="调整文件侧栏宽度" onResize={setWidth} pane={searching ? searchPane : open ? <div data-sidebar="sidebar" className="flex h-full min-w-0 flex-col bg-white"><LayoutWorkspaceSidebar activity={activity} /></div> : undefined}>{children}</ResizableSplit>}

    </div>
  )
}
