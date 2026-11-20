import { act, render, screen, cleanup, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
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

it("animates the Mac crash title to reclaim traffic-light space in fullscreen", async () => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel")
  const original = window.electronAPI
  let changed: ((value: boolean) => void) | undefined
  const off = vi.fn()
  Object.defineProperty(window, "electronAPI", { configurable: true, writable: true, value: {
    getWindowFullscreenState: vi.fn(async () => true),
    onWindowFullscreenChanged: (callback: (value: boolean) => void) => { changed = callback; return off }
  } })
  try {
    const view = render(<CrashFallbackView error="test" simulated />)
    const identity = document.querySelector<HTMLElement>('[data-crash-titlebar-identity]')!
    await waitFor(() => expect(identity.style.transform).toBe("translateX(-64px)"))
    expect(identity.className).toContain("transition-transform")
    act(() => changed?.(false))
    expect(identity.style.transform).toBe("translateX(0px)")
    view.unmount()
    expect(off).toHaveBeenCalledOnce()
  } finally { window.electronAPI = original; vi.restoreAllMocks() }
})
