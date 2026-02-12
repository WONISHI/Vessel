import { useWorkspace } from "@renderer/layout/hooks/useWorkspace"
import CanvasContent from "@renderer/components/core/canvas/index"

export default function Canvas() {
  const { fileType, activeFilePath } = useWorkspace()
  if (["md", "json"].includes(fileType!)) {
    return <CanvasContent activeFilePath={activeFilePath} fileType={fileType} />
  }

  return <div className="flex items-center justify-center h-full text-slate-300 text-sm">选择一个文件以开始预览</div>
}
