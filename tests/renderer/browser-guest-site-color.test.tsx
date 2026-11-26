import { act, cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { Guest } from "@/pages/browser/components/guest"
vi.mock("@/hooks/use-dark-appearance", () => ({ useDarkAppearance: () => false }))
vi.mock("@/pages/browser/favicon-color", () => ({ DEFAULT_SITE_COLOR: "#16a34a", faviconColor: async (data?: string) => data ? "#4792f1" : "#16a34a" }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
function mount(url: string, update = vi.fn()) {
  const tab = { id: url, url, favicon: `${url}/logo.svg`, zoom: 1 } as any
  const register = vi.fn()
  const result = render(<Guest tab={tab} visible register={register} update={update} />)
  const view = result.container.querySelector("webview")!
  Object.assign(view, { getWebContentsId: () => 1, send: vi.fn(), executeJavaScript: vi.fn().mockResolvedValue(undefined), getURL: () => url, getTitle: () => "Page", canGoBack: () => false, canGoForward: () => false, getZoomFactor: () => 1 })
  act(() => view.dispatchEvent(new Event("dom-ready")))
  return { ...result, view, tab, register, update }
}
it("retries a not-yet-ready icon without reloading and immediately reuses its color in a new tab", async () => {
  vi.useFakeTimers()
  const sample = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValue("image")
  vi.stubGlobal("electronAPI", { browserFaviconData: sample })
  const first = mount("https://color-retry.test")
  await act(async () => {})
  expect(sample).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(150) })
  expect(first.update).toHaveBeenCalledWith(first.tab.id, { faviconColor: "#4792f1" })
  first.unmount()
  const second = mount("https://color-retry.test")
  expect(second.update).toHaveBeenCalledWith(second.tab.id, { faviconColor: "#4792f1" })
  expect(sample).toHaveBeenCalledTimes(2)
})
it("does not cancel pending sampling when the parent supplies a new update callback", async () => {
  let resolve!: (data: string) => void
  vi.stubGlobal("electronAPI", { browserFaviconData: vi.fn(() => new Promise<string>(r => { resolve = r })) })
  const first = mount("https://color-callback.test")
  const latest = vi.fn()
  first.rerender(<Guest tab={first.tab} visible register={first.register} update={latest} />)
  await act(async () => { resolve("image") })
  expect(latest).toHaveBeenCalledWith(first.tab.id, { faviconColor: "#4792f1" })
})

it("preserves the site accent during reload and clears it when navigating to another origin", () => {
  const guest = mount("https://reload-accent.test/page")
  guest.update.mockClear()
  const navigate = (url: string) => act(() => guest.view.dispatchEvent(Object.assign(new Event("did-start-navigation"), { isMainFrame: true, isInPlace: false, url })))
  navigate(guest.tab.url)
  const reload = guest.update.mock.calls.at(-1)![1]
  expect(reload.loading).toBe(true)
  expect(reload).not.toHaveProperty("faviconColor")
  expect(reload).not.toHaveProperty("favicon")
  navigate("https://another-accent.test/page")
  expect(guest.update.mock.calls.at(-1)![1]).toMatchObject({ loading: true, favicon: undefined, faviconColor: undefined })
})
