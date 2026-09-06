import { useContext } from "react"
import { useLocation } from "react-router-dom"

import { AppRouterContext } from "./router"
import type {
  AppRouter,
  RouteLocationNormalized
} from "./types"

export function useRouter(): AppRouter {
  const router = useContext(AppRouterContext)

  if (!router) {
    throw new Error("useRouter 必须在 RouterProvider 内使用")
  }

  return router
}

export function useRoute(): RouteLocationNormalized {
  const router = useContext(AppRouterContext)
  const location = useLocation()

  if (!router) {
    throw new Error("useRoute 必须在 RouterProvider 内使用")
  }

  return router.normalizeNativeLocation(location)
}
