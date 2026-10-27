import { act, cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { Guest } from "@/pages/browser/components/guest"
vi.mock("@/hooks/use-dark-appearance", () => ({ useDarkAppearance: () => true }))
vi.mock("@/pages/browser/guest-appearance", () => ({ guestAppearanceScript: () => "theme-work" }))
afterEach(() => { cleanup(); vi.useRealTimers() })
it("reveals the document before theme work and defers background tab processing until selected", () => {
  vi.useFakeTimers()
  const update = vi.fn()
  const register = vi.fn()
  const tab = { id: "one", url: "https://example.com" } as any
  const result = render(<Guest tab={tab} visible={false} register={register} update={update} />)
  const view = result.container.querySelector("webview")!
  const execute = vi.fn().mockResolvedValue(undefined)
  Object.assign(view, { executeJavaScript: execute, getURL: () => tab.url, getTitle: () => "Example", canGoBack: () => false, canGoForward: () => false })
  act(() => { view.dispatchEvent(new Event("dom-ready")) })
  expect(update).toHaveBeenCalledWith("one", { loading: false, ready: true })
  act(() => { vi.advanceTimersByTime(1000) })
  expect(execute).not.toHaveBeenCalledWith("theme-work")
  result.rerender(<Guest tab={tab} visible register={register} update={update} />)
  act(() => { vi.advanceTimersByTime(149) })
  expect(execute).not.toHaveBeenCalledWith("theme-work")
  act(() => { vi.advanceTimersByTime(1) })
  expect(execute).toHaveBeenCalledWith("theme-work")
})
