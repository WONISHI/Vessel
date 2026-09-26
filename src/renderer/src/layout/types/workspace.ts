import { createContext } from "react"

export interface WorkspaceNode {
  name: string
  path: string
  type?: "file" | "directory"
  children?: WorkspaceNode[]
}
export interface WorkspaceData {
  name: string
  path: string
  files: WorkspaceNode[]
}
export interface WorkspaceContextType {
  workspace: WorkspaceData
  activeFilePath: string
  fileType: string | undefined
  openFiles: WorkspaceNode[]
  expandedFolders: string[]
  openFile: (file: WorkspaceNode) => void
  closeFile: (path: string) => void
  showHome: () => void
  setFolderExpanded: (path: string, open: boolean) => void
  changeCollapsible: (path: string) => void
}
export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)
