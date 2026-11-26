import { expect, it, vi } from "vitest"
import type { WebviewTag } from "electron"
import { markGuestReady, withGuest } from "@/pages/browser/guest-lifecycle"
it("does not invoke Electron methods on a new or detached guest", () => {
  const view = document.createElement("webview") as WebviewTag
  document.body.append(view)
  const stop = vi.fn()
  withGuest(view, stop)
  expect(stop).not.toHaveBeenCalled()
  markGuestReady(view, true)
  withGuest(view, stop)
  expect(stop).toHaveBeenCalledOnce()
  view.remove()
  withGuest(view, stop)
  expect(stop).toHaveBeenCalledOnce()
})
it("contains a guest teardown race instead of crashing the React tree", () => {
  const view = document.createElement("webview") as WebviewTag
  document.body.append(view)
  markGuestReady(view, true)
  expect(() =>
    withGuest(view, () => {
      throw new Error("The WebView must be attached to the DOM")
    })
  ).not.toThrow()
  markGuestReady(view, false)
  view.remove()
})

it("stops a connected guest before DOM-ready through the native API", async () => {
  const { stopGuestLoading } = await import("@/pages/browser/guest-lifecycle")
  const view = document.createElement("webview") as WebviewTag
  const stop = vi.fn().mockResolvedValue(undefined)
  const previous = window.electronAPI
  window.electronAPI = { stopBrowserTab: stop } as any
  Object.assign(view, { getWebContentsId: () => 42 })
  document.body.append(view)
  try {
    expect(await stopGuestLoading(view)).toBe(true)
    expect(stop).toHaveBeenCalledWith(42)
    view.remove()
    expect(await stopGuestLoading(view)).toBe(false)
    expect(stop).toHaveBeenCalledOnce()
  } finally { view.remove(); window.electronAPI = previous }
})
