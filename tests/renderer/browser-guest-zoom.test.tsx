import { act, cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { Guest } from "@/pages/browser/components/guest"
import { newTab } from "@/pages/browser/components/index-shared"

vi.mock("@/hooks/use-dark-appearance", () => ({ useDarkAppearance: () => false }))
vi.mock("@/pages/browser/guest-appearance", () => ({ guestAppearanceScript: () => "" }))
afterEach(cleanup)

function mount(zoom: number, visible = true) {
  let tab = { ...newTab(), url: "file:///prototype/index.html", zoom }
  const register = vi.fn()
  const update = vi.fn()
  const result = render(<Guest tab={tab} visible={visible} register={register} update={update} />)
  const view = result.container.querySelector("webview")!
  const setZoomFactor = vi.fn()
  Object.assign(view, {
    setZoomFactor,
    executeJavaScript: vi.fn().mockResolvedValue(false),
    getURL: () => tab.url,
    getTitle: () => "Prototype",
    canGoBack: () => false,
    canGoForward: () => false
  })
  return {
    view, setZoomFactor,
    event: (name: string) => act(() => { view.dispatchEvent(new Event(name)) }),
    rerender: (zoom: number, visible = true) => {
      tab = { ...tab, zoom }
      result.rerender(<Guest tab={tab} visible={visible} register={register} update={update} />)
    }
  }
}

it("restores 60% on guest creation and reapplies it after navigation finishes", () => {
  const guest = mount(0.6)
  expect(guest.view.getAttribute("webpreferences")).toBe("zoomFactor=0.6")
  guest.event("dom-ready")
  expect(guest.setZoomFactor).toHaveBeenLastCalledWith(0.6)
  guest.setZoomFactor.mockClear()
  guest.event("did-finish-load")
  expect(guest.setZoomFactor).toHaveBeenCalledWith(0.6)
})

it("uses the latest factor on reload, including a reset to 100%", () => {
  const guest = mount(0.6)
  guest.event("dom-ready")
  for (const zoom of [0.8, 1]) {
    guest.rerender(zoom)
    expect(guest.setZoomFactor).toHaveBeenLastCalledWith(zoom)
    guest.setZoomFactor.mockClear()
    guest.event("dom-ready")
    guest.event("did-finish-load")
    expect(guest.setZoomFactor.mock.calls.every(([value]) => value === zoom)).toBe(true)
    expect(guest.setZoomFactor).toHaveBeenCalled()
  }
  expect(guest.view.getAttribute("webpreferences")).toBe("zoomFactor=0.6")
})

it("reapplies the saved factor when a loaded background tab becomes visible", () => {
  const guest = mount(0.6, false)
  guest.event("dom-ready")
  guest.setZoomFactor.mockClear()
  guest.rerender(0.6, true)
  expect(guest.setZoomFactor).toHaveBeenCalledWith(0.6)
})
