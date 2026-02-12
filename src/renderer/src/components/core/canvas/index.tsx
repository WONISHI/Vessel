import { memo } from "react"
import MarkdownCanvas from "@renderer/components/core/canvas/variants/markdown"
import JSONCanvas from "@renderer/components/core/canvas/variants/json"
interface EditorTabsProps {
  fileType: string | undefined
  activeFilePath: string
}

const EditorCanvas = ({ fileType, activeFilePath }: EditorTabsProps) => {
  if (fileType === "md" || fileType === "markdown") {
    return <MarkdownCanvas activeFilePath={activeFilePath} />
  } else if (fileType === "json") {
    return <JSONCanvas activeFilePath={activeFilePath}></JSONCanvas>
  }
  return null
}

export default memo(EditorCanvas)
