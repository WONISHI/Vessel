import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { LayoutProps } from "./types"
import type { WorkspaceNode } from "./types/workspace"
import LayoutAside from "./layout-aside"
import LayoutMain from "./layout-main"
import { WorkspaceProvider } from "./contexts/WorkspaceProvider"

/** 工作台共享文件选择、标签和目录展开状态；aside 与 main 平级布局。 */
export default function Layout({ workspace }: LayoutProps) {
  const navigate = useNavigate()
  const [openFiles, setOpenFiles] = useState<WorkspaceNode[]>([])
  const [activeFilePath, setActiveFilePath] = useState("")
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])
  const setFolderExpanded = (path: string, open: boolean) => setExpandedFolders((current) => (open ? [...new Set([...current, path])] : current.filter((item) => item !== path)))
  const showHome = () => {
    setActiveFilePath("")
    navigate("/editor")
  }
  const openFile = (file: WorkspaceNode) => {
    setOpenFiles((current) => (current.some((item) => item.path === file.path) ? current : [...current, file]))
    setActiveFilePath(file.path)
    navigate("/editor/file")
  }
  const closeFile = (path: string) => {
    const index = openFiles.findIndex((file) => file.path === path)
    const remaining = openFiles.filter((file) => file.path !== path)
    setOpenFiles(remaining)
    if (path === activeFilePath) {
      const next = remaining[Math.max(0, index - 1)]
      if (next) {
        setActiveFilePath(next.path)
        navigate("/editor/file")
      } else showHome()
    }
  }
  return (
    <WorkspaceProvider
      value={{
        workspace,
        activeFilePath,
        openFiles,
        expandedFolders,
        openFile,
        closeFile,
        showHome,
        setFolderExpanded,
        fileType: activeFilePath.split(".").pop()?.toLowerCase(),
        changeCollapsible: (path) => setFolderExpanded(path, true)
      }}
    >
      <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-[#faf9f7] text-stone-800">
        <LayoutAside />
        <LayoutMain />
      </div>
    </WorkspaceProvider>
  )
}
