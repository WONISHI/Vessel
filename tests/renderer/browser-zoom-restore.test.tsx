import { act, cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { Guest } from "@/pages/browser/components/guest"
import type { Tab } from "@/pages/browser/components/index-shared"
vi.mock("@/hooks/use-dark-appearance", () => ({ useDarkAppearance: () => false }))
vi.mock("@/pages/browser/guest-appearance", () => ({ guestAppearanceScript: () => "" }))
afterEach(cleanup)
it("restores the latest saved zoom after navigation, app focus and tab reactivation", () => {
  let zoom = 1
  let tab = { id: "page", url: "file:///tmp/page.html", zoom: 0.8 } as Tab
  const register = vi.fn(), update = vi.fn()
  const result = render(<Guest tab={tab} visible register={register} update={update} />)
  const view = result.container.querySelector("webview")!
  const setZoom = vi.fn((value: number) => { zoom = value })
  Object.assign(view, { getZoomFactor: () => zoom, setZoomFactor: setZoom, executeJavaScript: vi.fn().mockResolvedValue(false), getURL: () => tab.url, getTitle: () => "Page", canGoBack: () => false, canGoForward: () => false })
  act(() => view.dispatchEvent(new Event("dom-ready")))
  expect(zoom).toBe(0.8)
  tab = { ...tab, zoom: 0.6 }
  result.rerender(<Guest tab={tab} visible register={register} update={update} />)
  expect(zoom).toBe(0.6)
  zoom = 1
  act(() => view.dispatchEvent(new Event("dom-ready")))
  expect(zoom).toBe(0.6)
  zoom = 1
  act(() => window.dispatchEvent(new Event("focus")))
  expect(zoom).toBe(0.6)
  zoom = 1
  act(() => view.dispatchEvent(new Event("did-stop-loading")))
  expect(zoom).toBe(0.6)
  result.rerender(<Guest tab={tab} visible={false} register={register} update={update} />)
  zoom = 1
  act(() => window.dispatchEvent(new Event("focus")))
  expect(zoom).toBe(1)
  result.rerender(<Guest tab={tab} visible register={register} update={update} />)
  expect(zoom).toBe(0.6)
  setZoom.mockClear()
  act(() => { window.dispatchEvent(new Event("focus")); view.dispatchEvent(new Event("focus")) })
  expect(setZoom).not.toHaveBeenCalled()
  result.unmount()
  zoom = 1
  act(() => window.dispatchEvent(new Event("focus")))
  expect(setZoom).not.toHaveBeenCalled()
})
