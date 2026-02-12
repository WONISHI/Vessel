import { useWorkspace } from "@renderer/layout/hooks/useWorkspace"
import CanvasContent from "@renderer/components/core/canvas/index"

export default function Canvas() {
  const { fileType, activeFilePath } = useWorkspace()

  return <CanvasContent activeFilePath={activeFilePath} fileType={fileType} />
}
