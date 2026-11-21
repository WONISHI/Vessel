import { createElement } from "react"
import { act, cleanup, render } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installPageTransitions, rememberPageContent, transitionPage } from "@/lib/page-transition"

beforeEach(() => {
  vi.useFakeTimers()
  document.body.replaceChildren()
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 1))
  vi.stubGlobal("cancelAnimationFrame", clearTimeout)
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); delete document.documentElement.dataset.pageTransition; delete (document as any).startViewTransition })
function mockTransition() {
  const start = vi.fn((update: () => Promise<void>) => {
    const updateCallbackDone = Promise.resolve().then(update)
    return { updateCallbackDone, ready: updateCallbackDone, finished: updateCallbackDone, skipTransition: vi.fn() }
  })
  document.startViewTransition = start as any
  return start
}

it("leaves first-time loading unanimated and only animates after that page finishes loading", async () => {
  const start = mockTransition()
  const loader = document.createElement("div")
  loader.dataset.pageTransitionLoading = ""
  document.body.append(loader)
  const stop = rememberPageContent("test-lazy-page")
  await vi.advanceTimersByTimeAsync(10)
  const change = vi.fn()
  await transitionPage(change, "test-lazy-page")
  expect(change).toHaveBeenCalledTimes(1)
  expect(start).not.toHaveBeenCalled()
  loader.remove()
  await vi.advanceTimersByTimeAsync(10)
  const switching = transitionPage(change, "test-lazy-page")
  await vi.advanceTimersByTimeAsync(10)
  await switching
  expect(start).toHaveBeenCalledTimes(1)
  expect(change).toHaveBeenCalledTimes(2)
  expect(document.documentElement.dataset.pageTransition).toBeUndefined()
  stop()
})

it("ignores hidden cached-page loaders and cancelled visits", async () => {
  const start = mockTransition()
  document.body.innerHTML = '<div hidden><div data-page-transition-loading></div></div>'
  const stop = rememberPageContent("test-cached-page")
  const cancel = rememberPageContent("test-abandoned-page")
  cancel()
  await vi.advanceTimersByTimeAsync(10)
  await transitionPage(() => {}, "test-abandoned-page")
  expect(start).not.toHaveBeenCalled()
  const switching = transitionPage(() => {}, "test-cached-page")
  await vi.advanceTimersByTimeAsync(10)
  await switching
  expect(start).toHaveBeenCalledTimes(1)
  stop()
})

it("transitions cached activity pages but preserves navigation arguments and skips document tabs", async () => {
  const start = mockTransition()
  const stop = rememberPageContent("git")
  await vi.advanceTimersByTimeAsync(10)
  const native = { state: { location: { pathname: "/editor/file" } }, navigate: vi.fn(async (..._args: unknown[]) => {}) }
  const original = native.navigate
  const uninstall = installPageTransitions({ nativeRouter: native } as any)
  const switching = native.navigate("/git", { state: { test: true } })
  await vi.advanceTimersByTimeAsync(10)
  await switching
  expect(original).toHaveBeenCalledWith("/git", { state: { test: true }, flushSync: true })
  expect(start).toHaveBeenCalledTimes(1)
  await native.navigate("/editor/file?other=1")
  expect(start).toHaveBeenCalledTimes(1)
  uninstall()
  expect(native.navigate).toBe(original)
  stop()
})

it("respects reduced motion even for loaded destinations", async () => {
  const start = mockTransition()
  const stop = rememberPageContent("test-motion-page")
  await vi.advanceTimersByTimeAsync(10)
  vi.stubGlobal("matchMedia", () => ({ matches: true }))
  const change = vi.fn()
  await transitionPage(change, "test-motion-page")
  expect(change).toHaveBeenCalledOnce()
  expect(start).not.toHaveBeenCalled()
  stop()
})

it("cancels an in-flight animation before navigating to a first-time page", async () => {
  const start = mockTransition()
  const stop = rememberPageContent("test-rapid-loaded")
  await vi.advanceTimersByTimeAsync(10)
  let release!: () => void
  const first = vi.fn(() => new Promise<void>(resolve => { release = resolve }))
  const switching = transitionPage(first, "test-rapid-loaded")
  await vi.advanceTimersByTimeAsync(1)
  const second = vi.fn()
  await transitionPage(second, "test-rapid-new")
  release()
  await vi.advanceTimersByTimeAsync(10)
  await switching
  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledOnce()
  expect(start).toHaveBeenCalledOnce()
  expect(start.mock.results[0].value.skipTransition).toHaveBeenCalledOnce()
  expect(document.documentElement.dataset.pageTransition).toBeUndefined()
  stop()
})

it("commits a loaded page without waiting for a render frame inside the snapshot callback", async () => {
  const stop = rememberPageContent("test-no-frame-wait")
  await vi.advanceTimersByTimeAsync(10)
  const start = mockTransition()
  const raf = vi.fn(() => { throw new Error("Rendering is suspended during a snapshot update") })
  vi.stubGlobal("requestAnimationFrame", raf)
  const change = vi.fn()
  await transitionPage(change, "test-no-frame-wait")
  expect(start).toHaveBeenCalledOnce()
  expect(change).toHaveBeenCalledOnce()
  expect(raf).not.toHaveBeenCalled()
  stop()
})

it("coalesces duplicate navigation without cancelling the animation", async () => {
  const stop = rememberPageContent("resources")
  await vi.advanceTimersByTimeAsync(10)
  const start = mockTransition()
  const native = { state: { location: { pathname: "/editor/file" } }, navigate: vi.fn(async (..._args: unknown[]) => {}) }
  const original = native.navigate
  const uninstall = installPageTransitions({ nativeRouter: native } as any)
  const first = native.navigate("/resources")
  const duplicate = native.navigate("/resources")
  expect(duplicate).toBe(first)
  await first
  expect(original).toHaveBeenCalledOnce()
  expect(start).toHaveBeenCalledOnce()
  expect(start.mock.results[0].value.skipTransition).not.toHaveBeenCalled()
  uninstall()
  stop()
})

it("commits the real router destination before the new snapshot is captured", async () => {
  const stop = rememberPageContent("image")
  await vi.advanceTimersByTimeAsync(10)
  const native = createMemoryRouter([
    { path: "/editor", element: createElement("h1", null, "old page") },
    { path: "/image", element: createElement("h1", null, "new page") }
  ], { initialEntries: ["/editor"] })
  const view = render(createElement(RouterProvider, { router: native }))
  const start = mockTransition()
  const uninstall = installPageTransitions({ nativeRouter: native } as any)
  let snapshotContent: string | null = null
  document.startViewTransition = ((update: () => Promise<void>) => {
    const transition = start(async () => {
      await update()
      snapshotContent = view.container.textContent
    })
    return transition
  }) as any
  await act(async () => { await native.navigate("/image") })
  expect(snapshotContent).toBe("new page")
  expect(start).toHaveBeenCalledOnce()
  uninstall()
  native.dispose()
  stop()
})
