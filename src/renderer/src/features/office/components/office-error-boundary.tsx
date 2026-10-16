import "@/assets/tailwind.css"
import { Component, type ReactNode } from "react"

/** Keeps rendering failures within this component subtree and exposes recovery. */
export class OfficeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: "" }

  /** Returns derived state from error. */
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message || String(error) }
  }

  /** Performs the component did catch operation. */
  componentDidCatch(error: Error) {
    console.error("Office root error:", error)
  }

  /** Renders the current view. */
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", height: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui" }}>
          <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>文档加载失败：{this.state.error}</p>
          <button
            style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #d6d3d1", background: "#fff", cursor: "pointer", fontSize: 13 }}
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
