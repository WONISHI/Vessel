import type { ComponentProps } from "react"
import ActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { DevToolsBody } from "@/pages/debug/components/dev-tools-body"
import { useNavigate } from "react-router-dom"

/** Renders the dev tools index component. */
export function DevToolsIndex(props: ComponentProps<typeof DevToolsBody>) {
  const navigate = useNavigate()
  return (
    <Layout
      aside={
        <ActivityBar
          activity="tools"
          onActivityChange={(item) => navigate(item === "tools" ? "/devtools" : item === "files" ? "/editor" : `/${item}`)}
        />
      }
    >
      <DevToolsBody {...props} />
    </Layout>
  )
}
