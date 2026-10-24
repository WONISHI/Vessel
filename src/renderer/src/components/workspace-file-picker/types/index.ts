import type { WorkspaceNode } from "@/components/workspace/types/workspace"

export interface FilePickerWorkspace {
  scope?: "workspace" | "resources"
  activePath?: string
  closeFile?: (path: string) => void
  root: string
  files: WorkspaceNode[]
  openFile: (file: WorkspaceNode) => void
}

/** Optional scope makes global workspace search independent of the visible resource project. */
export type FilePickerRequest = ((workspace: FilePickerWorkspace) => void) & { scope?: "workspace" | "resources" }
