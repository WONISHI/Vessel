import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { markGuestReady } from "@/pages/browser/guest-lifecycle"
import type { WebviewTag } from "electron"
import { BrowserDevtoolsPane } from "@/pages/browser/components/browser-page/browser-devtools-pane"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("shows the occluded console frame and removes it when the live view returns", () => {
  let receive!: (value: { id: number; image?: string }) => void
  const unsubscribe = vi.fn()
  vi.stubGlobal("electronAPI", { onBrowserDevtoolsPreview: (callback: typeof receive) => { receive = callback; return unsubscribe } })
  const guest = Object.assign(document.createElement("webview"), { getWebContentsId: () => 7 }) as unknown as WebviewTag
  document.body.append(guest)
  markGuestReady(guest, true)
  const b = { tab: { id: "one" }, views: { current: new Map([["one", guest]]) }, dock: "bottom", consoleFont: "Menlo", consoleSize: 13, devtoolsHost: { current: null }, setDevtoolsOpen: vi.fn(), setDock: vi.fn(), setConsoleFont: vi.fn(), setConsoleSize: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserDevtoolsPane b={b} />)
  act(() => receive({ id: 8, image: "unrelated" }))
  expect(screen.queryByAltText("被浮层遮挡的控制台画面")).toBeNull()
  act(() => receive({ id: 7, image: "data:image/png;base64,console" }))
  expect(screen.getByAltText("被浮层遮挡的控制台画面").getAttribute("src")).toBe("data:image/png;base64,console")
  act(() => receive({ id: 7 }))
  expect(screen.queryByAltText("被浮层遮挡的控制台画面")).toBeNull()
  guest.remove()
  view.unmount()
  expect(unsubscribe).toHaveBeenCalledOnce()
})

it("retains its DOM snapshot during page transitions even when normal visibility sync clears portal previews", async () => {
  const { pageTransitionSurfaces } = await import("@/lib/page-transition-surfaces")
  let receive!: (value: { id: number; image?: string }) => void
  const transition = vi.fn(async (_token: number, preparing: boolean) => preparing ? { id: 7, image: "data:image/png;base64,transition" } : undefined)
  vi.stubGlobal("electronAPI", { setBrowserDevtoolsTransition: transition, onBrowserDevtoolsPreview: (cb: typeof receive) => { receive = cb; return () => {} } })
  const guest = Object.assign(document.createElement("webview"), { getWebContentsId: () => 7 }) as unknown as WebviewTag
  document.body.append(guest); markGuestReady(guest, true)
  const b = { tab: { id: "one" }, views: { current: new Map([["one", guest]]) }, dock: "right", consoleFont: "Menlo", consoleSize: 13, devtoolsHost: { current: null }, setDevtoolsOpen: vi.fn(), setDock: vi.fn(), setConsoleFont: vi.fn(), setConsoleSize: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserDevtoolsPane b={b} />)
  const surface = pageTransitionSurfaces()[0]
  await act(() => surface.prepare(1))
  act(() => receive({ id: 7 }))
  expect(screen.getByAltText("被浮层遮挡的控制台画面").getAttribute("src")).toBe("data:image/png;base64,transition")
  await act(() => surface.finish(1))
  expect(screen.queryByAltText("被浮层遮挡的控制台画面")).toBeNull()
  expect(transition.mock.calls).toEqual([[1, true], [1, false]])
  view.unmount(); guest.remove()
  expect(pageTransitionSurfaces()).toHaveLength(0)
})
