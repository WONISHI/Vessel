import { type Editor } from '@tiptap/react'
export interface ToolbarProps {
    editor?: any;
    // fileType: string;
}

export type MarkdownToolbarItem = {
    label: string
    icon: React.ElementType
    action: (editor: Editor) => void,
    groups?: Array<Omit<MarkdownToolbarItem, 'groups'>>
}