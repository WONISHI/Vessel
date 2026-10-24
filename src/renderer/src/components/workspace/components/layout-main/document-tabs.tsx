import { StatusTarget } from "@/components/workspace/components/layout-main/status-context"
import CanvasContent from "@/components/core/canvas/index"
import type { WorkspaceNode } from "@/components/workspace/types/workspace"
import { getFileExtension } from "@vessel/utils"
import { useRef, useContext, type ReactNode } from "react"

/** Keep visited open documents mounted until their tab closes. */
export function DocumentTabs({ files, activePath, workspacePath, home, children }: { files: WorkspaceNode[]; activePath: string; workspacePath: string; home: boolean; children: ReactNode }) {
  const statusTarget = useContext(StatusTarget)
  const visited = useRef(new Set<string>())
  const openPaths = new Set(files.map((file) => file.path))
  for (const path of visited.current) if (!openPaths.has(path)) visited.current.delete(path)
  if (!home && activePath && openPaths.has(activePath)) visited.current.add(activePath)
  return (
    <>
      {home && children}
      {files.filter((file) => visited.current.has(file.path)).map((file) => {
        const visible = !home && file.path === activePath
        return (
          <div key={file.path} data-document-tab={file.path} aria-hidden={!visible} inert={!visible} className="min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={{ display: visible ? "flex" : "none" }}>
            <StatusTarget.Provider value={visible ? statusTarget : null}><CanvasContent activeFilePath={file.path} fileType={getFileExtension(file.path)} workspacePath={workspacePath} /></StatusTarget.Provider>
          </div>
        )
      })}
    </>
  )
}
