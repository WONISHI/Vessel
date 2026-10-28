import { render, screen, cleanup } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { CrashFallbackView } from "@/components/core/error-boundary/crash-fallback/components/crash-fallback-view"
afterEach(cleanup)
it("keeps the original error visible when preload failed to expose electronAPI", () => {
  const original = window.electronAPI
  Object.defineProperty(window, 'electronAPI', { configurable: true, writable: true, value: undefined })
  try {
    const view = render(<CrashFallbackView error={new Error("original preload failure")} />)
    expect(screen.getByText("original preload failure")).toBeDefined()
    expect(screen.getByText("重启应用")).toBeDefined()
    view.unmount()
  } finally {
    window.electronAPI = original
  }
})
