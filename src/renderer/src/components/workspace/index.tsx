import Layout from "@/components/layout/index"
import LayoutAside from "@/components/workspace/components/layout-aside/index"
import LayoutMain from "@/components/workspace/components/layout-main/index"
import { WorkspaceProvider } from "@/components/workspace/contexts/WorkspaceProvider"
import { useWorkspaceController } from "@/components/workspace/hooks/useWorkspaceController"
import type { WorkspacePageProps } from "@/components/workspace/types/index"

/** 组装工作区页面，为侧栏、标签栏和路由内容提供共享业务状态。 */
export default function WorkspacePage({ workspace, initialFile, scope = "workspace", active = true }: WorkspacePageProps & { initialFile?: string; scope?: "workspace" | "resources"; active?: boolean }) {
  const workspaceController = useWorkspaceController(workspace, initialFile, scope, false, active)
  return (
    <WorkspaceProvider value={workspaceController}>
      <Layout aside={null}>
        <LayoutAside resources={scope === "resources"}>
          <LayoutMain resources={scope === "resources"} />
        </LayoutAside>
      </Layout>
    </WorkspaceProvider>
  )
}
