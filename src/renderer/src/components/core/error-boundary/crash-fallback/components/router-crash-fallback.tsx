import { CrashFallbackView } from "@/components/core/error-boundary/crash-fallback/components/crash-fallback-view"
import { useRouteError } from "react-router-dom"

/** Renders the router crash fallback component. */
export function RouterCrashFallback() {
  const error = useRouteError()
  return <CrashFallbackView error={error} />
}
