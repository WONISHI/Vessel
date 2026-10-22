import type { WorkspaceNode } from "@/components/workspace/types/workspace"

export interface FilePickerWorkspace {
  scope?: "workspace" | "resources"
  activePath?: string
  closeFile?: (path: string) => void
  root: string
  files: WorkspaceNode[]
  openFile: (file: WorkspaceNode) => void
}
