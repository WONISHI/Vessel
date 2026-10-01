import { expect, it, vi } from "vitest"
import type { WebviewTag } from "electron"
import { markGuestReady, withGuest } from "../../src/renderer/src/pages/browser/guest-lifecycle"
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
  document.body.append(view); markGuestReady(view, true)
  expect(() => withGuest(view, () => { throw new Error("The WebView must be attached to the DOM") })).not.toThrow()
  markGuestReady(view, false); view.remove()
})
