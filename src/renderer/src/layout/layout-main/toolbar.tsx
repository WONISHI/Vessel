import MarkdownToolbar from "@/components/core/toolbar/variants/markdown-toolbar"
import { useWorkspace } from '@/layout/context/WorkspaceContext';
export default function ToolBar() {
    const { editor } = useWorkspace();
    return (
        <MarkdownToolbar editor={{editor}}></MarkdownToolbar>
    )
}