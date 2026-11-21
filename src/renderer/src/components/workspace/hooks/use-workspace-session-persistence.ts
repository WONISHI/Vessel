import { useEffect } from "react"
import type { WorkspaceNode } from "@/components/workspace/types/workspace"

/** Publish state to the main-process memory store; that store coalesces disk writes. */
export function useWorkspaceSessionPersistence(key: string, files: WorkspaceNode[], active: string, expanded: string[]) {
  useEffect(() => {
    if (!key) return
    const snapshot = { files: files.map(({ name, path }) => ({ name, path })), active, expanded }
    void window.electronAPI.setWorkspaceSession(key, snapshot).catch(error => console.error("保存工作区标签失败", error))
  }, [key, files, active, expanded])
}
