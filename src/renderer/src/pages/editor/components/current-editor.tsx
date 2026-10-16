import WorkspacePage from "@/components/workspace/index"
import { readCurrentWorkspace } from "@/router/components/index-shared"
import type { WorkspaceData } from "@vessel/type"
import { useEffect, useState } from "react"

/** Renders the current editor component. */
export function CurrentEditor() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(() => {
    return readCurrentWorkspace()
  })

  useEffect(() => {
    /** Refreshes the current state. */
    const update = () => setWorkspace(readCurrentWorkspace())
    window.addEventListener("vessel:workspace-changed", update)
    return () => window.removeEventListener("vessel:workspace-changed", update)
  }, [])

  if (!workspace) {
    return null
  }

  return (
    <WorkspacePage
      key={workspace.path}
      workspace={workspace}
    />
  )
}
