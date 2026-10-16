import CanvasContent from "@/components/core/canvas/index"
import { useWorkspace } from "@/components/workspace/hooks/useWorkspace"

/** Renders the canvas component. */
export default function Canvas() {
  const { fileType, activeFilePath, workspace } = useWorkspace()

  return (
    <CanvasContent
      activeFilePath={activeFilePath}
      fileType={fileType}
      workspacePath={workspace?.path}
    />
  )
}
