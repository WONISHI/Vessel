import Layout from "@/components/layout/index"
import { DiagnosticsContent } from "@/pages/debug/diagnostics/components/diagnostics-content"

/** Renders standalone diagnostics without the workspace activity rail. */
export function DiagnosticsPage() {
  return (
    <Layout aside={null}>
      <DiagnosticsContent />
    </Layout>
  )
}
