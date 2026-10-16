import { useContext } from "react"
import { useLocation } from "react-router-dom"

import { AppRouterContext } from "#vessel-react-router/router"
import type { AppRouter, RouteLocationNormalized } from "#vessel-react-router/types"

/** Provides the router hook. */
export function useRouter(): AppRouter {
  const router = useContext(AppRouterContext)

  if (!router) {
    throw new Error("useRouter 必须在 RouterProvider 内使用")
  }

  return router
}

/** Provides the route hook. */
export function useRoute(): RouteLocationNormalized {
  const router = useContext(AppRouterContext)
  const location = useLocation()

  if (!router) {
    throw new Error("useRoute 必须在 RouterProvider 内使用")
  }

  return router.normalizeNativeLocation(location)
}
