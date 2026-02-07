import Canvas from "@/components/core/canvas/index"
import { useWorkspace } from '@/layout/context/WorkspaceContext';
export default function ToolBar() {
    const { editor, fileType } = useWorkspace();
    return (
        <Canvas editor={editor} fileType={fileType}></Canvas>
    )
}