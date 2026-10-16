import ActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { DiagnosticsContent } from "@/pages/debug/diagnostics/components/diagnostics-content"
import { useRouter } from "@vessel/react-router"

/** Renders the diagnostics page component. */
export function DiagnosticsPage() {
  const router = useRouter()
  return (
    <Layout
      aside={
        <ActivityBar
          activity="tools"
          onActivityChange={(item) => {
            void router.push(item === "tools" ? "/devtools" : item === "files" ? "/editor" : `/${item}`)
          }}
        />
      }
    >
      <DiagnosticsContent />
    </Layout>
  )
}
