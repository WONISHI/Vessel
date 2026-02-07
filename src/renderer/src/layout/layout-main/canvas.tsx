import { useContext } from "react";
import { WorkspaceContext } from "@/layout/context/WorkspaceContext";
import MarkdownCanvas from "@/components/core/canvas/variants/markdown-canvas";

export default function Canvas() {
    const { editor, fileType, activeFilePath } = useContext(WorkspaceContext) as any;
    if (fileType === 'md' || fileType === 'markdown') {
        return <MarkdownCanvas editor={editor} activeFilePath={activeFilePath} />;
    }

    return (
        <div className="flex items-center justify-center h-full text-slate-300 text-sm">
            选择一个文件以开始预览
        </div>
    );
}