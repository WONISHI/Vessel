import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { createMemoryHistory, createRouter } from "@vessel/react-router"
import { RouterProvider } from "@vessel/react-router/components"
import { hasSavedStartupRoute, installRoutePersistence, LAST_ROUTE_KEY } from "@/router/route-persistence"

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function setup(saved: unknown, entry = "/") {
  let stored = saved
  const getAppState = vi.fn(async () => stored)
  const setAppState = vi.fn(async (_key: string, value: unknown) => { stored = value })
  Object.assign(window, { electronAPI: { getAppState, setAppState } })
  const Page = () => <div>Page</div>
  const router = createRouter({ history: createMemoryHistory([entry]), routes: [
    { path: "/", component: Page }, { path: "/browser", component: Page },
    { path: "/devtools/proxy", component: Page }, { path: "/editor/file", component: Page }
  ] })
  installRoutePersistence(router)
  return { router, getAppState, setAppState, stored: () => stored }
}
it("restores the complete nested route and saves subsequent successful navigation", async () => {
  const { router, stored, setAppState } = setup("/editor/file?path=hello%20world.md#section")
  render(<RouterProvider router={router}/>)
  await waitFor(() => expect(router.currentRoute.fullPath).toBe("/editor/file?path=hello%20world.md#section"))
  await waitFor(() => expect(setAppState).toHaveBeenCalledWith(LAST_ROUTE_KEY, router.currentRoute.fullPath))
  await router.push("/devtools/proxy")
  await waitFor(() => expect(stored()).toBe("/devtools/proxy"))
})
it("preserves an explicit startup route instead of replacing it with the saved page", async () => {
  const { router, stored } = setup("/devtools/proxy", "/browser")
  render(<RouterProvider router={router}/>)
  await waitFor(() => expect(stored()).toBe("/browser"))
  expect(router.currentRoute.fullPath).toBe("/browser")
})
it.each(["/removed-page", "//example.test/path", "https://example.test/path"])("falls back to home for an invalid saved route %s", async saved => {
  const { router, stored } = setup(saved)
  render(<RouterProvider router={router}/>)
  await waitFor(() => expect(stored()).toBe("/"))
  expect(router.currentRoute.fullPath).toBe("/")
  expect(hasSavedStartupRoute()).toBe(true)
})
it("remembers a deliberate home page and does not save aborted navigation", async () => {
  const { router, stored } = setup("/")
  router.beforeEach(to => to.path === "/browser" ? false : true)
  render(<RouterProvider router={router}/>)
  await waitFor(() => expect(hasSavedStartupRoute()).toBe(true))
  await router.isReady()
  await router.push("/browser")
  expect(stored()).toBe("/")
})
