import { memo } from "react"
import MarkdownCanvas from "@/components/core/canvas/variants/markdown-canvas"
interface EditorTabsProps {
  fileType: string
  editor: any
  activeFilePath: string
}

const EditorCanvas = ({ fileType, editor, activeFilePath }: EditorTabsProps) => {
  if (!editor) return null
  if (fileType === "md" || fileType === "markdown") {
    return <MarkdownCanvas editor={editor} activeFilePath={activeFilePath} />
  }
  return null
}

export default memo(EditorCanvas)
