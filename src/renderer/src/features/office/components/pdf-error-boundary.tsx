import { Component, type ReactNode } from "react"

/** Keeps rendering failures within this component subtree and exposes recovery. */
export class PdfErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: "" }

  /** Returns derived state from error. */
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message || String(error) }
  }

  /** Renders the current view. */
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-stone-500">
          <p className="mb-2 text-sm text-red-600">PDF 渲染失败：{this.state.error}</p>
          <button
            className="rounded border border-stone-300 bg-white px-3 py-1 text-xs hover:bg-stone-50"
            onClick={() => this.setState({ hasError: false, error: "" })}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
