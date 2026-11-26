import type { AppRouter } from "@vessel/react-router"

export const LAST_ROUTE_KEY = "navigation:last-route"
let savedStartupRoute = false
export const hasSavedStartupRoute = () => savedStartupRoute

function internalRoute(value: unknown): value is string {
  return typeof value === "string" && value.length <= 16384 && value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n\0]/.test(value)
}

/** Restore before rendering; persist only successful, registered application routes. */
export function installRoutePersistence(router: AppRouter) {
  let initial = true
  let lastWritten = ""
  savedStartupRoute = false
  router.beforeEach(async to => {
    if (!initial) return true
    initial = false
    try {
      const saved = await window.electronAPI.getAppState<unknown>(LAST_ROUTE_KEY)
      savedStartupRoute = saved !== null && saved !== undefined
      if (!internalRoute(saved) || !router.resolve(saved).matched.length) return true
      // Explicit navigation (including a window reload) takes precedence over restoration.
      if (to.fullPath === "/" && saved !== "/") return saved
    } catch (error) {
      console.error("读取上次页面失败", error)
    }
    return true
  })
  router.afterEach(async (to, _from, failure) => {
    if (failure || !to.matched.length || !internalRoute(to.fullPath) || lastWritten === to.fullPath) return
    try {
      await window.electronAPI.setAppState(LAST_ROUTE_KEY, to.fullPath)
      lastWritten = to.fullPath
    } catch (error) {
      console.error("保存当前页面失败", error)
    }
  })
}
