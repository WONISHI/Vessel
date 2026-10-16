import type { GlobalErrorBoundaryProps, GlobalErrorBoundaryState } from "@/components/core/error-boundary/crash-fallback/components/crash-fallback-shared"
import { CrashFallbackView } from "@/components/core/error-boundary/crash-fallback/components/crash-fallback-view"
import { Component, type ErrorInfo, type ReactNode } from "react"

/** Keeps rendering failures within this component subtree and exposes recovery. */
export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  /** Initializes the instance and its required dependencies. */
  constructor(props: GlobalErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  /** Returns derived state from error. */
  static getDerivedStateFromError(error: unknown): GlobalErrorBoundaryState {
    return { hasError: true, error }
  }

  /** Performs the component did catch operation. */
  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("GlobalErrorBoundary 捕获异常:", error, info)
  }

  /** Clears the captured error so the child view can render again. */
  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  /** Renders the current view. */
  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <CrashFallbackView
          error={this.state.error}
          onReset={this.handleReset}
        />
      )
    }
    return this.props.children
  }
}
