import { ReactNode } from "react"
import { WorkspaceContext } from "../types/workspace"

// 定义 Props 类型
interface WorkspaceProviderProps {
  children: ReactNode
  value: {
    workspace: any
    activeFilePath: string
    fileType: string | undefined
    onSave: () => void
    changeCollapsible: (path: string) => void
  }
}

export const WorkspaceProvider = ({ children, value }: WorkspaceProviderProps) => {
  return <WorkspaceContext.Provider value={{ ...value }}> {children}</WorkspaceContext.Provider>
}
