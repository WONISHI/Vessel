import { createContext } from "react"

import type { FileTreeNode } from "@vessel/utils"

/** 工作区使用的通用文件节点。 */
export type WorkspaceNode = FileTreeNode
export interface WorkspaceData {
  name: string
  path: string
  files: WorkspaceNode[]
}
export interface WorkspaceContextType {
  /** 当前工作区的名称、路径及扫描数据。 */
  workspace: WorkspaceData
  /** 当前激活文件路径；首页为空字符串。 */
  activeFilePath: string
  /** 当前文件的小写扩展名。 */
  fileType: string | undefined
  /** 已打开标签对应的文件列表。 */
  openFiles: WorkspaceNode[]
  /** 当前展开目录的路径集合。 */
  expandedFolders: string[]
  /** 打开或激活文件标签，并导航到文件内容页。 */
  openWorkspaceFile: (file: WorkspaceNode) => void
  /** 关闭文件标签，并按需切换到相邻标签。 */
  closeWorkspaceFile: (path: string) => void
  /** 返回工作区首页，保留已打开标签。 */
  navigateToWorkspaceHome: () => void
  /** 更新目录展开状态，驱动懒加载树展示。 */
  setDirectoryExpanded: (path: string, open: boolean) => void
  /** 展开指定目录，供路径导航使用。 */
  expandDirectory: (path: string) => void
}
export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)
