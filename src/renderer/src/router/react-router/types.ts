import type {
  ComponentType,
  LazyExoticComponent,
  ReactNode
} from "react"
import type {
  ActionFunction,
  LoaderFunction,
  Params,
  ShouldRevalidateFunction
} from "react-router-dom"

export type Awaitable<T> = T | Promise<T>

export type RouteMeta = Record<string, unknown>

export type RouteQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined

export type RouteQuery = Record<
  string,
  RouteQueryValue | RouteQueryValue[]
>

export interface RouteLocationObject {
  name?: string
  path?: string
  params?: Record<string, string | number | null | undefined>
  query?: RouteQuery
  hash?: string
  state?: unknown
}

export type RouteLocationRaw = string | RouteLocationObject

export interface RouteLocationMatched {
  id: string
  name?: string
  path: string
  meta: RouteMeta
  record: AppRouteRecordRaw
}

export interface RouteLocationNormalized {
  fullPath: string
  path: string
  name?: string
  params: Readonly<Params<string>>
  query: Record<string, string | string[]>
  hash: string
  state: unknown
  meta: RouteMeta
  matched: RouteLocationMatched[]
}

export type NavigationGuardReturn =
  | void
  | true
  | false
  | RouteLocationRaw

export type NavigationGuardNext = (
  result?: NavigationGuardReturn
) => void

export type NavigationGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) => Awaitable<NavigationGuardReturn>

export interface NavigationFailure {
  type: "aborted" | "error"
  error?: unknown
}

export type AfterNavigationHook = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  failure?: NavigationFailure
) => Awaitable<void>

export type RouterErrorHandler = (
  error: unknown,
  to?: RouteLocationNormalized,
  from?: RouteLocationNormalized
) => void

export type RoutePropsOption =
  | boolean
  | Record<string, unknown>
  | ((route: RouteLocationNormalized) => Record<string, unknown>)

export type RouteComponent =
  | ComponentType<any>
  | LazyExoticComponent<ComponentType<any>>

export interface AppRouteRecordRaw {
  id?: string
  path?: string
  index?: boolean
  name?: string
  component?: RouteComponent
  element?: ReactNode
  children?: AppRouteRecordRaw[]
  redirect?:
    | RouteLocationRaw
    | ((to: RouteLocationNormalized) => RouteLocationRaw)
  meta?: RouteMeta
  props?: RoutePropsOption
  beforeEnter?: NavigationGuard | NavigationGuard[]
  loader?: LoaderFunction
  action?: ActionFunction
  shouldRevalidate?: ShouldRevalidateFunction
  errorElement?: ReactNode
  caseSensitive?: boolean
}

export interface RouterHistory {
  type: "browser" | "hash" | "memory"
  basename: string
  initialEntries?: string[]
  initialIndex?: number
}

export interface CreateRouterOptions {
  history: RouterHistory
  routes: AppRouteRecordRaw[]
}

export interface RouterProviderProps {
  router: AppRouter
}

export interface RouterViewProps {
  context?: unknown
}

export interface GuardOutcomeAllow {
  type: "allow"
}

export interface GuardOutcomeAbort {
  type: "abort"
}

export interface GuardOutcomeRedirect {
  type: "redirect"
  to: RouteLocationRaw
}

export type GuardOutcome =
  | GuardOutcomeAllow
  | GuardOutcomeAbort
  | GuardOutcomeRedirect

export interface AppRouter {
  readonly currentRoute: RouteLocationNormalized
  readonly routes: AppRouteRecordRaw[]
  push(to: RouteLocationRaw): Promise<void>
  replace(to: RouteLocationRaw): Promise<void>
  go(delta: number): Promise<void>
  back(): Promise<void>
  forward(): Promise<void>
  resolve(to: RouteLocationRaw): RouteLocationNormalized
  beforeEach(guard: NavigationGuard): () => void
  beforeResolve(guard: NavigationGuard): () => void
  afterEach(hook: AfterNavigationHook): () => void
  onError(handler: RouterErrorHandler): () => void
  isReady(): Promise<void>
}
