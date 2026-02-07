import Toolbar from "@/components/core/toolbar/index"
import { useWorkspace } from '@/layout/context/WorkspaceContext';
export default function ToolBar() {
    const { editor, fileType } = useWorkspace();
    return (
        <Toolbar editor={editor} fileType={fileType}></Toolbar>
    )
}