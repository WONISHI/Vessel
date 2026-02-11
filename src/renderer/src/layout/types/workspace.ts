export interface WorkspaceContextType {
  workspace: any
  activeFilePath: string
  fileType: string | undefined
  onSave: () => void
  changeCollapsible: (path: string) => void
}

// 在此处创建并导出Context对象
import { createContext } from "react"
// prettier-ignore
export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
)
