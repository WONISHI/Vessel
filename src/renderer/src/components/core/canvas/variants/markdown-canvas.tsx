import { EditorContent } from '@tiptap/react'
import { ToolbarProps } from "@/components/core/toolbar/types";
export default function MarkdownCanvas({ editor }: ToolbarProps){
    return <EditorContent editor={editor} className="flex-1 outline-none border-none" />
}