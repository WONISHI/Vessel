import { type Editor } from "@tiptap/react"
export interface ToolbarProps {
  editor?: any
  activeFilePath?: string
  onSave?: () => void
}

export type MarkdownToolbarItem = {
  label: string
  icon: React.ElementType
  action: (editor: Editor) => void
  groups?: Array<Omit<MarkdownToolbarItem, "groups">>
}
