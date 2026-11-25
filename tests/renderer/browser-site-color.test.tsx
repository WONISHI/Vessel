import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { Guest } from "@/pages/browser/components/guest"
import { newTab } from "@/pages/browser/components/index-shared"
const mock = vi.hoisted(() => ({ color: vi.fn() }))
vi.mock("@/pages/browser/favicon-color", () => ({ DEFAULT_SITE_COLOR: "#16a34a", faviconColor: mock.color }))
vi.mock("@/hooks/use-dark-appearance", () => ({ useDarkAppearance: () => false }))
vi.mock("@/pages/browser/guest-appearance", () => ({ guestAppearanceScript: () => "" }))
afterEach(cleanup)

it("synchronizes the menu and guest color, ignores an old icon result and restores green on failure", async () => {
  let resolveOld!: (data: string) => void
  const fetch = vi.fn().mockImplementationOnce(() => new Promise<string>(resolve => { resolveOld = resolve }))
    .mockResolvedValueOnce("new-icon").mockRejectedValueOnce(new Error("offline"))
  mock.color.mockImplementation(async (data: string) => data === "new-icon" ? "#4792f1" : data ? "#ff0000" : "#16a34a")
  window.electronAPI = { browserFaviconData: fetch } as any
  const update = vi.fn(), register = vi.fn(), send = vi.fn()
  const tab = { ...newTab(), url: "https://example.com", favicon: "https://example.com/old.png" }
  const result = render(<Guest tab={tab} visible register={register} update={update} />)
  const view = result.container.querySelector("webview")!
  Object.assign(view, { send, getWebContentsId: () => 7, executeJavaScript: vi.fn().mockResolvedValue(undefined), getURL: () => tab.url, getTitle: () => "Example", canGoBack: () => false, canGoForward: () => false })
  act(() => { view.dispatchEvent(new Event("dom-ready")) })
  expect(send).toHaveBeenCalledWith("vessel:site-color", "#16a34a")
  result.rerender(<Guest tab={{ ...tab, favicon: "https://example.com/new.png" }} visible register={register} update={update} />)
  await waitFor(() => expect(update).toHaveBeenCalledWith(tab.id, { faviconColor: "#4792f1" }))
  await act(async () => { resolveOld("old-icon") })
  expect(send).not.toHaveBeenCalledWith("vessel:site-color", "#ff0000")
  result.rerender(<Guest tab={{ ...tab, favicon: "https://example.com/broken.png" }} visible register={register} update={update} />)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(send).toHaveBeenLastCalledWith("vessel:site-color", "#16a34a")
  expect(update).toHaveBeenLastCalledWith(tab.id, { faviconColor: "#16a34a" })
  fetch.mockResolvedValueOnce("new-icon")
  act(() => { window.dispatchEvent(new CustomEvent("vessel-favicon-loaded", { detail: "https://example.com/broken.png" })) })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4))
  await waitFor(() => expect(send).toHaveBeenLastCalledWith("vessel:site-color", "#4792f1"))
  // A later request for the same visible icon may fail or decode as empty.
  // Neither the refresh's pending state nor its fallback may erase the good color.
  for (const empty of [false, true]) {
    send.mockClear()
    update.mockClear()
    if (empty) fetch.mockResolvedValueOnce(undefined)
    else fetch.mockRejectedValueOnce(new Error("temporary network failure"))
    await act(async () => {
      window.dispatchEvent(new CustomEvent("vessel-favicon-loaded", { detail: "https://example.com/broken.png" }))
    })
    expect(send).toHaveBeenLastCalledWith("vessel:site-color", "#4792f1")
    expect(send).not.toHaveBeenCalledWith("vessel:site-color", "#16a34a")
    expect(update).not.toHaveBeenCalledWith(tab.id, { faviconColor: "#16a34a" })
  }

})
