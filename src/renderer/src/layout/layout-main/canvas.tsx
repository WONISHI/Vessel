import { useWorkspace } from "@renderer/layout/hooks/useWorkspace"
import MarkdownCanvas from "@/components/core/canvas/variants/markdown-canvas"

export default function Canvas() {
  const { fileType, activeFilePath } = useWorkspace()
  if (fileType === "md" || fileType === "markdown") {
    return <MarkdownCanvas activeFilePath={activeFilePath} />
  }

  return <div className="flex items-center justify-center h-full text-slate-300 text-sm">选择一个文件以开始预览</div>
}
