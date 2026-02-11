import { memo } from "react"
import MarkdownToolbar from "@/components/core/toolbar/variants/markdown-toolbar"
interface EditorTabsProps {
  fileType: string;
  activeFilePath: string;
}

const EditorTabs = ({ fileType, activeFilePath }: EditorTabsProps) => {
  if (fileType === 'md' || fileType === 'markdown') {
    return <MarkdownToolbar activeFilePath={activeFilePath} />
  }
  return null
}

export default memo(EditorTabs)
