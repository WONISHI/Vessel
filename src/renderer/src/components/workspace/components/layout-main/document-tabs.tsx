import { WorkspaceVisible, DOCUMENT_CACHE_LIMIT, BACKGROUND_RELEASE_MS, canEvictDocument } from "./document-cache"
import { StatusTarget } from "@/components/workspace/components/layout-main/status-context"
import CanvasContent from "@/components/core/canvas/index"
import type { WorkspaceNode } from "@/components/workspace/types/workspace"
import { getFileExtension } from "@vessel/utils"
import { useRef, useContext, useEffect, useState, type ReactNode } from "react"

/** Bound editor instances while preserving open tabs and lightweight document sessions. */
export function DocumentTabs({ files, activePath, workspacePath, home, children }: { files: WorkspaceNode[]; activePath: string; workspacePath: string; home: boolean; children: ReactNode }) {
  const statusTarget = useContext(StatusTarget)
  const workspaceVisible = useContext(WorkspaceVisible)
  const [released, setReleased] = useState(false)
  useEffect(() => {
    if (workspaceVisible && !home) { setReleased(false); return }
    const timer = setTimeout(() => setReleased(true), BACKGROUND_RELEASE_MS)
    return () => clearTimeout(timer)
  }, [workspaceVisible, home])
  const visited = useRef(new Set<string>())
  const openPaths = new Set(files.map((file) => file.path))
  for (const path of visited.current) if (!openPaths.has(path)) visited.current.delete(path)
  if (!home && workspaceVisible && activePath && openPaths.has(activePath)) {
    visited.current.delete(activePath)
    visited.current.add(activePath)
  }
  const cached = [...visited.current].filter(canEvictDocument)
  for (const path of cached.slice(0, Math.max(0, cached.length - DOCUMENT_CACHE_LIMIT))) visited.current.delete(path)
  if (released && (!workspaceVisible || home)) for (const path of visited.current) if (canEvictDocument(path)) visited.current.delete(path)
  return (
    <>
      {home && children}
      {files.filter((file) => visited.current.has(file.path)).map((file) => {
        const visible = workspaceVisible && !home && file.path === activePath
        return (
          <div key={file.path} data-document-tab={file.path} aria-hidden={!visible} inert={!visible} className="min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={{ display: visible ? "flex" : "none" }}>
            <StatusTarget.Provider value={visible ? statusTarget : null}><CanvasContent activeFilePath={file.path} fileType={getFileExtension(file.path)} workspacePath={workspacePath} /></StatusTarget.Provider>
          </div>
        )
      })}
    </>
  )
}
