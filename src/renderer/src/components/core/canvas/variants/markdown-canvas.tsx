import { EditorContent } from '@tiptap/react'
import { ToolbarProps } from "@/components/core/toolbar/types";
import { useEffect, useState } from 'react';
import { marked } from 'marked'
import { toast } from "sonner"

export default function MarkdownCanvas({ editor, activeFilePath }: ToolbarProps) {
    const [isReading, setIsReading] = useState(false)
    if (!editor) return null;

    const loadFile = async (path: string) => {
        setIsReading(true)
        try {
            const mdContent = await window.electronAPI.readContent(path)
            const htmlContent = await marked.parse(mdContent)
            editor?.commands.setContent(htmlContent)
        } catch (err) {
            toast.error('读取文件失败')
        } finally {
            setIsReading(false)
        }
    }

    useEffect(() => {
        if (editor && activeFilePath) {
            loadFile(activeFilePath)
        }
    }, [editor, activeFilePath])

    return (
        <div className="flex-1 overflow-y-auto w-full flex justify-center bg-[#fafafa]">
            {/* 纸张容器 */}
            <div className={`w-full bg-white shadow-sm border border-slate-200/60 rounded-sm px-12 py-10 cursor-text ${isReading ? 'opacity-30' : 'opacity-100'}`}
                onClick={() => editor.chain().focus().run()}>

                <EditorContent editor={editor} className="outline-none" />

            </div>
        </div>
    )
}