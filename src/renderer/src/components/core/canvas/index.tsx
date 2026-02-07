
import { memo } from "react"
import MarkdownCanvas from "@/components/core/canvas/variants/markdown-canvas"
interface EditorTabsProps {
  fileType: string;
  editor: any;
}

const EditorCanvas = ({ fileType, editor }: EditorTabsProps) => {
  if (!editor) return null;
  if (fileType === 'md' || fileType === 'markdown') {
    return <MarkdownCanvas editor={editor} />
  }
  return null;
}

export default memo(EditorCanvas)