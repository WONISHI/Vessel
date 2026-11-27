import { createElement } from "react"
import { act, cleanup, render } from "@testing-library/react"
import { createMemoryRouter, Navigate, RouterProvider } from "react-router-dom"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installPageTransitions, pageTransitionKey, rememberPageContent, transitionPage } from "@/lib/page-transition"

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

it("animates history back from settings and forward while preserving the real history entry", async () => {
  const stopEditor = rememberPageContent("editor"), stopSettings = rememberPageContent("settings")
  await vi.advanceTimersByTimeAsync(10)
  const native = createMemoryRouter([
    { path: "/editor/file", element: createElement("h1", null, "editor content") },
    { path: "/settings", element: createElement("h1", null, "settings content") }
  ], { initialEntries: [{ pathname: "/editor/file", search: "?file=note.md", state: { preserved: true } }] })
  const uninstall = installPageTransitions({ nativeRouter: native } as any)
  const view = render(createElement(RouterProvider, { router: native }))
  await act(async () => { await native.navigate("/settings") })
  const start = mockTransition()
  const snapshots: (string | null)[] = []
  document.startViewTransition = ((update: () => Promise<void>) => start(async () => {
    await update()
    snapshots.push(view.container.textContent)
  })) as any
  await act(async () => { await native.navigate(-1) })
  expect(start).toHaveBeenCalledOnce()
  expect(snapshots).toEqual(["editor content"])
  expect(native.state.location).toMatchObject({ pathname: "/editor/file", search: "?file=note.md", state: { preserved: true } })
  await act(async () => { await native.navigate(1) })
  expect(start).toHaveBeenCalledTimes(2)
  expect(snapshots).toEqual(["editor content", "settings content"])
  uninstall()
  native.dispose()
  stopEditor(); stopSettings()
})


it("animates revisiting the debug menu destination through its default-page redirect", async () => {
  const native = createMemoryRouter([
    { path: "/editor", element: createElement("h1", null, "workspace") },
    { path: "/debug", element: createElement(Navigate, { to: "/debug/performance", replace: true }) },
    { path: "/debug/performance", element: createElement("h1", null, "debug performance") }
  ], { initialEntries: ["/editor"] })
  const uninstall = installPageTransitions({ nativeRouter: native } as any)
  const view = render(createElement(RouterProvider, { router: native }))
  const start = mockTransition()
  await act(async () => { await native.navigate("/debug") })
  expect(native.state.location.pathname).toBe("/debug/performance")
  expect(start).not.toHaveBeenCalled()
  const stopDebug = rememberPageContent("debug"), stopEditor = rememberPageContent("editor")
  await vi.advanceTimersByTimeAsync(10)
  await act(async () => { await native.navigate("/editor") })
  expect(start).toHaveBeenCalledOnce()
  let snapshot: string | null = null
  document.startViewTransition = ((update: () => Promise<void>) => start(async () => {
    await update()
    snapshot = view.container.textContent
  })) as any
  await act(async () => { await native.navigate("/debug") })
  expect(start).toHaveBeenCalledTimes(2)
  expect(snapshot).toBe("debug performance")
  expect(start.mock.results[1].value.skipTransition).not.toHaveBeenCalled()
  await act(async () => { await native.navigate(-1) })
  expect(start).toHaveBeenCalledTimes(3)
  expect(snapshot).toBe("workspace")
  expect(start.mock.results[2].value.skipTransition).not.toHaveBeenCalled()
  uninstall()
  native.dispose()
  stopDebug(); stopEditor()
})


it("animates history back between loaded diagnostic child pages", async () => {
  const stop = rememberPageContent("debug")
  await vi.advanceTimersByTimeAsync(10)
  const native = createMemoryRouter([
    { path: "/debug/performance", element: createElement("h1", null, "performance") },
    { path: "/debug/storage", element: createElement("h1", null, "storage") }
  ], { initialEntries: ["/debug/performance"] })
  const uninstall = installPageTransitions({ nativeRouter: native } as any)
  const view = render(createElement(RouterProvider, { router: native }))
  const start = mockTransition()
  await act(async () => { await native.navigate("/debug/storage") })
  let snapshot: string | null = null
  document.startViewTransition = ((update: () => Promise<void>) => start(async () => {
    await update()
    snapshot = view.container.textContent
  })) as any
  await act(async () => { await native.navigate(-1) })
  expect(start).toHaveBeenCalledTimes(2)
  expect(snapshot).toBe("performance")
  expect(start.mock.results[1].value.skipTransition).not.toHaveBeenCalled()
  uninstall()
  native.dispose()
  stop()
})

it("waits for native surface snapshots before starting and releases them only after the animation", async () => {
  const { registerPageTransitionSurface } = await import("@/lib/page-transition-surfaces")
  const stop = rememberPageContent("test-native-surface")
  await vi.advanceTimersByTimeAsync(10)
  let prepared!: () => void, finished!: () => void
  const preparation = new Promise<void>(resolve => { prepared = resolve })
  const animation = new Promise<void>(resolve => { finished = resolve })
  const prepare = vi.fn(() => preparation), finish = vi.fn(async () => {})
  const unregister = registerPageTransitionSurface({ prepare, finish })
  const start = vi.fn((update: () => Promise<void>) => {
    const updateCallbackDone = Promise.resolve().then(update)
    return { updateCallbackDone, ready: updateCallbackDone, finished: animation, skipTransition: vi.fn() }
  })
  document.startViewTransition = start as any
  try {
    const change = vi.fn()
    const result = transitionPage(change, "test-native-surface")
    expect(prepare).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
    prepared()
    await result
    expect(change).toHaveBeenCalledOnce()
    expect(finish).not.toHaveBeenCalled()
    finished()
    await vi.advanceTimersByTimeAsync(1)
    expect(finish).toHaveBeenCalledWith(prepare.mock.calls[0][0])
  } finally { unregister(); stop() }
})

it("releases a cancelled preparation and never commits its stale navigation", async () => {
  const { registerPageTransitionSurface } = await import("@/lib/page-transition-surfaces")
  const stop = rememberPageContent("test-cancel-native")
  await vi.advanceTimersByTimeAsync(10)
  const start = mockTransition()
  let prepared!: () => void
  const prepare = vi.fn(() => new Promise<void>(resolve => { prepared = resolve })), finish = vi.fn(async () => {})
  const unregister = registerPageTransitionSurface({ prepare, finish })
  try {
    const stale = vi.fn(), next = vi.fn()
    const pending = transitionPage(stale, "test-cancel-native")
    unregister()
    await transitionPage(next, "unloaded-native-page")
    expect(finish).toHaveBeenCalledOnce()
    prepared(); await pending
    expect(stale).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
    expect(finish).toHaveBeenCalledOnce()
  } finally { unregister(); stop() }
})

it("retains native frames on an unanimated first visit so returning can animate the console", async () => {
  const { registerPageTransitionSurface } = await import("@/lib/page-transition-surfaces")
  const order: string[] = []
  const unregister = registerPageTransitionSurface({ prepare: async () => { order.push("prepare") }, finish: async () => { order.push("finish") } })
  const start = mockTransition()
  try {
    await transitionPage(() => { order.push("navigate") }, "first-visit-native-destination")
    expect(order).toEqual(["prepare", "navigate", "finish"])
    expect(start).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.pageTransition).toBeUndefined()
  } finally { unregister() }
})

it("animates the first user-domain visit and the return to login as distinct pages", async () => {
  const start = mockTransition()
  expect(pageTransitionKey('/login/user-domain')).toBe('user-domain')
  expect(pageTransitionKey('/login?mode=register')).toBe('login')
  const stop = rememberPageContent('login')
  await vi.advanceTimersByTimeAsync(10)
  const native = createMemoryRouter([
    { path: '/login', element: createElement('h1', null, 'login form') },
    { path: '/login/user-domain', element: createElement('h1', null, 'domain form') }
  ], { initialEntries: ['/login'] })
  const uninstall = installPageTransitions({ nativeRouter: native } as any)
  render(createElement(RouterProvider, { router: native }))
  await act(async () => { await native.navigate('/login/user-domain') })
  expect(start).toHaveBeenCalledTimes(1)
  expect(document.body.textContent).toBe('domain form')
  await act(async () => { await native.navigate('/login') })
  expect(start).toHaveBeenCalledTimes(2)
  await act(async () => { await native.navigate('/login?mode=register') })
  expect(start).toHaveBeenCalledTimes(2)
  uninstall(); stop()
})
