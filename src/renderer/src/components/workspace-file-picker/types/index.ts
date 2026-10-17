import type { WorkspaceNode } from "@/components/workspace/types/workspace"

export interface FilePickerWorkspace {
  root: string
  files: WorkspaceNode[]
  openFile: (file: WorkspaceNode) => void
}
