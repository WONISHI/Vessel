import { type ReactNode } from "react"
export interface CrashFallbackViewProps {
  error?: unknown
  onReset?: () => void
}
export interface GlobalErrorBoundaryProps {
  children: ReactNode
}
export interface GlobalErrorBoundaryState {
  hasError: boolean
  error: unknown
}

export { GlobalErrorBoundary } from "@/components/core/error-boundary/crash-fallback/components/global-error-boundary"
