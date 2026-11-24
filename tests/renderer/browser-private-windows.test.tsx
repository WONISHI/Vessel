import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { newTab } from "@/pages/browser/components/index-shared"
import { useBrowserWindows } from "@/pages/browser/use-browser-windows"
import { useBrowserState } from "@/pages/browser/components/browser-page/hooks/use-browser-state"
import { BROWSER_TABS_KEY, BROWSER_ACTIVE_TAB_KEY } from "@/pages/browser/components/index-shared"

vi.mock("@vessel/react-router", () => ({ useRouter: () => ({}) }))
const create = vi.fn(async () => "vessel-private-test")
const close = vi.fn(async () => {})
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("electronAPI", { createBrowserPrivateSession: create, closeBrowserPrivateSession: close,
    onBrowserDevtoolsClosed: () => () => {}, syncBrowserBookmarks: vi.fn(async () => {}) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })
const user = { ...newTab(), id: "user-tab", url: "https://user.example/", title: "User" }
it("retains both collections across switches, then destroys private tabs and starts fresh", async () => {
  const { result } = renderHook(() => useBrowserWindows({ tabs: [user], activeId: user.id }))
  await act(() => result.current.enterIncognito())
  const firstPrivateId = result.current.active
  expect(result.current.tabs).toHaveLength(1)
  expect(result.current.tabs[0]).toMatchObject({ title: "新标签页", url: "" })
  const privateTab = { ...newTab(), url: "https://private.example/", title: "Private" }
  act(() => { result.current.setTabs(tabs => [...tabs, privateTab]); result.current.setActiveId(privateTab.id) })
  act(() => result.current.switchUserWindow())
  expect(result.current.tabs).toEqual([user])
  expect(result.current.active).toBe(user.id)
  expect(result.current.allTabs).toHaveLength(3)
  await act(() => result.current.enterIncognito())
  expect(create).toHaveBeenCalledTimes(1)
  expect(result.current.active).toBe(privateTab.id)
  expect(result.current.tabs[0].id).toBe(firstPrivateId)
  act(() => result.current.setAllTabs(tabs => tabs.map(tab => tab.id === user.id ? { ...tab, title: "Loaded in background" } : tab)))
  await act(() => result.current.closeIncognito())
  expect(close).toHaveBeenCalledTimes(1)
  expect(result.current.incognito).toBe(false)
  expect(result.current.privateWindow).toBeUndefined()
  expect(result.current.tabs[0].title).toBe("Loaded in background")
  await act(() => result.current.enterIncognito())
  expect(result.current.tabs).toHaveLength(1)
  expect(result.current.tabs[0].id).not.toBe(firstPrivateId)
})
it("persists only user tabs and active ID while private tabs navigate", async () => {
  localStorage.setItem(BROWSER_TABS_KEY, JSON.stringify([user]))
  localStorage.setItem(BROWSER_ACTIVE_TAB_KEY, user.id)
  const { result } = renderHook(() => useBrowserState(false))
  await act(() => result.current.enterIncognito())
  act(() => result.current.setTabs(tabs => tabs.map(tab => ({ ...tab, url: "https://secret.example/", title: "Secret" }))))
  expect(localStorage.getItem(BROWSER_TABS_KEY)).not.toContain("secret")
  expect(localStorage.getItem(BROWSER_ACTIVE_TAB_KEY)).toBe(user.id)
  expect(result.current.userWindow.tabs[0].url).toBe(user.url)
  await act(() => result.current.closeIncognito())
})
it("keeps the user window intact if private session creation fails", async () => {
  create.mockRejectedValueOnce(new Error("failed"))
  const { result } = renderHook(() => useBrowserWindows({ tabs: [user], activeId: user.id }))
  await act(async () => { await expect(result.current.enterIncognito()).rejects.toThrow("failed") })
  expect(result.current.incognito).toBe(false)
  expect(result.current.tabs).toEqual([user])
})

it("prepares the private session before animating first entry and reuses transitions when switching windows", async () => {
  let prepared!: (partition: string) => void
  create.mockImplementationOnce(() => new Promise(resolve => { prepared = resolve }))
  const start = vi.fn((update: () => Promise<void>) => {
    const done = Promise.resolve().then(update)
    return { updateCallbackDone: done, ready: done, finished: done, skipTransition: vi.fn() }
  })
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: start })
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
  const page = renderHook(() => useBrowserState(true))
  try {
    act(() => page.result.current.setFindOpen(true))
    let entering!: Promise<void>
    act(() => { entering = page.result.current.enterIncognito() })
    expect(start).not.toHaveBeenCalled()
    expect(page.result.current.incognito).toBe(false)
    await act(async () => { prepared("private-animation-test"); await entering })
    expect(start).toHaveBeenCalledTimes(1)
    expect(page.result.current.incognito).toBe(true)
    expect(page.result.current.findOpen).toBe(false)
    await act(async () => { page.result.current.switchUserWindow(); await Promise.resolve() })
    expect(start).toHaveBeenCalledTimes(2)
    expect(page.result.current.incognito).toBe(false)
    await act(async () => { await page.result.current.enterIncognito() })
    expect(start).toHaveBeenCalledTimes(3)
    expect(create).toHaveBeenCalledOnce()
    expect(page.result.current.incognito).toBe(true)
  } finally {
    await act(async () => { await page.result.current.closeIncognito() })
    page.unmount()
    delete (document as Document & { startViewTransition?: unknown }).startViewTransition
  }
})


it("disposes a prepared session when a superseded transition never commits it", async () => {
  const page = renderHook(() => useBrowserWindows({ tabs: [user], activeId: user.id }))
  await act(async () => { await page.result.current.enterIncognito(vi.fn(async () => undefined)) })
  expect(close).toHaveBeenCalledOnce()
  expect(page.result.current.incognito).toBe(false)
  expect(page.result.current.privateWindow).toBeUndefined()
})
