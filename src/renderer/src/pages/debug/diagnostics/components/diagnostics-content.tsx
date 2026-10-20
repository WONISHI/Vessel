import { DiagnosticsBreadcrumb } from "@/pages/debug/diagnostics/components/diagnostics-breadcrumb"
import { RouterView } from "@vessel/react-router/components"
import "@/pages/debug/diagnostics/diagnostics.css"

/** Keeps shared navigation outside the diagnostic child route outlet. */
export function DiagnosticsContent() {
  return (
    <div className="diagnostics-layout flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <DiagnosticsBreadcrumb />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <RouterView />
      </main>
    </div>
  )
}
