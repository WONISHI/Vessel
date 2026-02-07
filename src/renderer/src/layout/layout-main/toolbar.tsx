import { useContext } from "react";
import { WorkspaceContext } from "@/layout/context/WorkspaceContext";
import MarkdownToolbar from "@/components/core/toolbar/variants/markdown-toolbar";

export default function ToolBar() {
    const { editor, fileType, onSave } = useContext(WorkspaceContext) as any;
    if (fileType === 'md' || fileType === 'markdown') {
        return <MarkdownToolbar editor={editor} onSave={onSave} />;
    }

    return null;
}