import { memo } from "react"
import MarkdownToolbar from "@/components/core/toolbar/variants/markdown-toolbar"
interface EditorTabsProps {
  fileType: string;
  editor: any;
}

const EditorTabs = ({ fileType, editor }: EditorTabsProps) => {
  if (!editor) return null;
  if (fileType === 'md' || fileType === 'markdown') {
    return <MarkdownToolbar editor={editor} />
  }
  return null;
}

export default memo(EditorTabs)
