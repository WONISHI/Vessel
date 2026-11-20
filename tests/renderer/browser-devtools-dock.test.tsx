import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useBrowserPage } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))

let closeDetached: () => void
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  Object.defineProperty(window, "electronAPI", { configurable: true, value: {
    syncBrowserBookmarks: vi.fn(async () => {}),
    setBrowserDevtools: vi.fn(async () => {}),
    onBrowserNewTab: vi.fn(() => vi.fn()),
    onBrowserDevtoolsClosed: vi.fn((handler: () => void) => { closeDetached = handler; return vi.fn() })
  } })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })

it.each(["detached", "left", "right", "bottom"])("remembers %s after close, reopen and browser remount, including inspect", (dock) => {
  const page = renderHook(() => useBrowserPage(false))
  act(() => { page.result.current.setDock(dock); page.result.current.setDevtoolsOpen(true) })
  expect(localStorage.getItem("browser-devtools-dock")).toBe(dock)
  act(() => closeDetached())
  expect(page.result.current.devtoolsOpen).toBe(false)
  act(() => page.result.current.setDevtoolsOpen(true))
  expect(page.result.current.dock).toBe(dock)
  act(() => page.result.current.setDevtoolsOpen(false))
  act(() => page.result.current.inspectPage({ x: 120, y: 80 }))
  expect(page.result.current.devtoolsOpen).toBe(true)
  expect(page.result.current.dock).toBe(dock)
  expect(localStorage.getItem("browser-devtools-dock")).toBe(dock)
  page.unmount()

  const restored = renderHook(() => useBrowserPage(false))
  expect(restored.result.current.dock).toBe(dock)
  act(() => restored.result.current.inspectPage({ x: 25, y: 40 }))
  expect(restored.result.current.devtoolsOpen).toBe(true)
  expect(restored.result.current.dock).toBe(dock)
})
