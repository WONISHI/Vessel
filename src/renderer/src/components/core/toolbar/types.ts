export interface ToolbarProps {
  editor?: any
  activeFilePath?: string
  onSave?: () => void
}

export type MarkdownToolbarItem = {
  label: string
  icon: React.ElementType
  groups?: Array<Omit<MarkdownToolbarItem, "groups">>
}
