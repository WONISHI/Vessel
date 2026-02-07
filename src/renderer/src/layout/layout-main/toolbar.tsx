import Toolbar from "@/components/core/toolbar/variants/markdown-toolbar"
import { useWorkspace } from '@/layout/context/WorkspaceContext';
export default function ToolBar() {
    const { editor, fileType } = useWorkspace();
    return (
        <Toolbar editor={{ editor, fileType }}></Toolbar>
    )
}