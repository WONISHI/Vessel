import { useWorkspace } from "@/layout/hooks/useWorkspace"
import MarkdownToolbar from "@/components/core/toolbar/variants/markdown-toolbar"

export default function ToolBar() {
  const { fileType, onSave } = useWorkspace()
  if (fileType === "md" || fileType === "markdown") {
    return <MarkdownToolbar onSave={onSave} />
  }

  return null
}
