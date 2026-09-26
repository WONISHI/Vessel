import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { getFileExtension } from "@vessel/utils"
import type { WorkspaceData, WorkspaceNode, WorkspaceContextType } from "../types/workspace"

/**
 * 管理工作区标签、当前文件与目录展开状态，实现侧栏和主区联动。
 * @param workspace 当前工作区数据。
 * @returns 提供给页面 Context 的受控状态与操作方法。
 */
export function useWorkspaceController(workspace: WorkspaceData): WorkspaceContextType {
  const navigate = useNavigate()
  const [openFiles, setOpenFiles] = useState<WorkspaceNode[]>([])
  const [activeFilePath, setActiveFilePath] = useState("")
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])
  /** 更新目录展开集合，供懒加载树切换可见层级。
   * @param path 目录的唯一文件系统路径。
   * @param open 是否展开目录。 */
  const setDirectoryExpanded = (path: string, open: boolean) => setExpandedFolders((current) => (open ? [...new Set([...current, path])] : current.filter((item) => item !== path)))
  /** 清除当前文件选择并返回工作区首页，保留已打开的标签。 */
  const navigateToWorkspaceHome = () => {
    setActiveFilePath("")
    navigate("/editor")
  }
  /** 激活文件标签，避免重复添加，并导航至文件内容路由。
   * @param file 要打开的文件节点。 */
  const openWorkspaceFile = (file: WorkspaceNode) => {
    setOpenFiles((current) => (current.some((item) => item.path === file.path) ? current : [...current, file]))
    setActiveFilePath(file.path)
    navigate("/editor/file")
  }
  /** 关闭指定标签；关闭当前标签时优先选择左侧标签，否则返回首页。
   * @param path 要关闭的文件路径。 */
  const closeWorkspaceFile = (path: string) => {
    const index = openFiles.findIndex((file) => file.path === path)
    const remaining = openFiles.filter((file) => file.path !== path)
    setOpenFiles(remaining)
    if (path === activeFilePath) {
      const next = remaining[Math.max(0, index - 1)]
      if (next) {
        setActiveFilePath(next.path)
        navigate("/editor/file")
      } else navigateToWorkspaceHome()
    }
  }
  return {
    workspace,
    activeFilePath,
    openFiles,
    expandedFolders,
    openWorkspaceFile,
    closeWorkspaceFile,
    navigateToWorkspaceHome,
    setDirectoryExpanded,
    fileType: getFileExtension(activeFilePath),
    expandDirectory: (path) => setDirectoryExpanded(path, true)
  }
}
