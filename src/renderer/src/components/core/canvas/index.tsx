import { memo } from "react"
import MarkdownCanvas from "@renderer/components/core/canvas/variants/markdown"
import JSONCanvas from "@renderer/components/core/canvas/variants/json"
import MediaCanvas from "@renderer/components/core/canvas/variants/media"
interface EditorTabsProps {
  fileType: string | undefined
  activeFilePath: string
}

const EditorCanvas = ({ fileType, activeFilePath }: EditorTabsProps) => {
  if (fileType === "md" || fileType === "markdown") {
    return <MarkdownCanvas activeFilePath={activeFilePath} />
  } else if (fileType === "json") {
    return <JSONCanvas activeFilePath={activeFilePath}></JSONCanvas>
  } else if (["png", "jpg", "jpeg", "bmp", "gif", "webp"].includes(fileType!)) {
    return <MediaCanvas activeFilePath={activeFilePath}></MediaCanvas>
  }
  return <div className="flex items-center justify-center h-full text-slate-300 text-sm">选择一个文件以开始预览</div>
}

export default memo(EditorCanvas)
