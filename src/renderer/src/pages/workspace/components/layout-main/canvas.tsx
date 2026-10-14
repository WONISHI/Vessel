import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import CanvasContent from "@renderer/components/core/canvas/index"

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

