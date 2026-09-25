export { RouterController, createRouter } from "./router"

export { useRoute, useRouter } from "./hooks"

export { createMemoryHistory, createWebHashHistory, createWebHistory } from "./history"

export type {
  AfterNavigationHook,
  AppRouteRecordRaw,
  AppRouter,
  CreateRouterOptions,
  NavigationFailure,
  NavigationGuard,
  NavigationGuardNext,
  NavigationGuardReturn,
  RouteLocationMatched,
  RouteLocationNormalized,
  RouteLocationObject,
  RouteLocationRaw,
  RouteMeta,
  RoutePropsOption,
  RouteQuery,
  RouteQueryValue,
  RouterErrorHandler,
  RouterHistory,
  RouterProviderProps,
  RouterViewProps
} from "./types"
