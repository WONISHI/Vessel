import Layout from "@/layout"
import type { WorkspacePageProps } from "./types"
import LayoutAside from "./components/layout-aside"
import LayoutMain from "./components/layout-main"
import { WorkspaceProvider } from "./contexts/WorkspaceProvider"
import { useWorkspaceController } from "./hooks/useWorkspaceController"

/** 组装工作区页面，为侧栏、标签栏和路由内容提供共享业务状态。 */
export default function WorkspacePage({ workspace, initialFile, scope = "workspace", active = true }: WorkspacePageProps & { initialFile?: string; scope?: "workspace" | "resources"; active?: boolean }) {
  const workspaceController = useWorkspaceController(workspace, initialFile, scope, false, active)
  return (
    <WorkspaceProvider value={workspaceController}>
      <Layout aside={null}>
        <LayoutAside resources={scope === "resources"}><LayoutMain resources={scope === "resources"} /></LayoutAside>
      </Layout>
    </WorkspaceProvider>
  )
}
