import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type LazyExoticComponent
} from "react"
import {
  Navigate,
  Outlet,
  createBrowserRouter,
  createHashRouter,
  createMemoryRouter,
  generatePath,
  matchRoutes,
  useBlocker,
  useLocation,
  type Location,
  type Params,
  type RouteMatch,
  type RouteObject
} from "react-router-dom"

import type {
  AfterNavigationHook,
  AppRouteRecordRaw,
  AppRouter,
  CreateRouterOptions,
  GuardOutcome,
  NavigationFailure,
  NavigationGuard,
  NavigationGuardReturn,
  RouteLocationMatched,
  RouteLocationNormalized,
  RouteLocationRaw,
  RoutePropsOption,
  RouterErrorHandler
} from "./types"

type ReactDataRouter = ReturnType<typeof createBrowserRouter>

interface RouteDefinition {
  id: string
  fullPath: string
  record: AppRouteRecordRaw
}

interface InternalRouteHandle {
  __appRouter: RouteDefinition
}

interface NativeLocationLike {
  pathname: string
  search?: string
  hash?: string
  state?: unknown
}

const START_LOCATION: RouteLocationNormalized = {
  fullPath: "",
  path: "",
  params: {},
  query: {},
  hash: "",
  state: null,
  meta: {},
  matched: []
}

export const AppRouterContext =
  createContext<RouterController | null>(null)

function useRouterController(): RouterController {
  const router = useContext(AppRouterContext)

  if (!router) {
    throw new Error("路由组件必须在 RouterProvider 内使用")
  }

  return router
}

function useCurrentRoute(): RouteLocationNormalized {
  const router = useRouterController()
  const location = useLocation()

  return router.normalizeNativeLocation(location)
}

function joinRoutePath(parentPath: string, path?: string): string {
  if (!path) {
    return parentPath || "/"
  }

  if (path.startsWith("/")) {
    return path
  }

  if (!parentPath || parentPath === "/") {
    return `/${path}`
  }

  return `${parentPath.replace(/\/$/, "")}/${path}`
}

function createDefinitions(routes: AppRouteRecordRaw[]): {
  definitionMap: WeakMap<AppRouteRecordRaw, RouteDefinition>
  nameMap: Map<string, RouteDefinition>
} {
  const definitionMap = new WeakMap<
    AppRouteRecordRaw,
    RouteDefinition
  >()
  const nameMap = new Map<string, RouteDefinition>()
  const ids = new Set<string>()
  let autoId = 0

  const walk = (
    records: AppRouteRecordRaw[],
    parentPath = "/"
  ) => {
    records.forEach((record) => {
      if (record.index && record.path) {
        throw new Error("Index route 不能同时设置 path")
      }

      if (record.index && record.children?.length) {
        throw new Error("Index route 不能设置 children")
      }

      const id = record.id || record.name || `route-${++autoId}`

      if (ids.has(id)) {
        throw new Error(`路由 id 重复：${id}`)
      }

      ids.add(id)

      const fullPath = record.index
        ? parentPath
        : joinRoutePath(parentPath, record.path)
      const definition: RouteDefinition = {
        id,
        fullPath,
        record
      }

      definitionMap.set(record, definition)

      if (record.name) {
        if (nameMap.has(record.name)) {
          throw new Error(`路由 name 重复：${record.name}`)
        }

        nameMap.set(record.name, definition)
      }

      if (record.children?.length) {
        walk(record.children, fullPath)
      }
    })
  }

  walk(routes)

  return {
    definitionMap,
    nameMap
  }
}

function parseQuery(search: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  const searchParams = new URLSearchParams(search)

  searchParams.forEach((value, key) => {
    const currentValue = result[key]

    if (currentValue === undefined) {
      result[key] = value
      return
    }

    result[key] = Array.isArray(currentValue)
      ? [...currentValue, value]
      : [currentValue, value]
  })

  return result
}

function stringifyQuery(
  query: Record<
    string,
    | string
    | number
    | boolean
    | null
    | undefined
    | Array<string | number | boolean | null | undefined>
  >
): string {
  const searchParams = new URLSearchParams()

  Object.entries(query).forEach(([key, rawValue]) => {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]

    values.forEach((value) => {
      if (value === undefined) {
        return
      }

      searchParams.append(key, value === null ? "" : String(value))
    })
  })

  const search = searchParams.toString()

  return search ? `?${search}` : ""
}

function normalizeHash(hash?: string): string {
  if (!hash) {
    return ""
  }

  return hash.startsWith("#") ? hash : `#${hash}`
}

function normalizeParams(
  params: Record<string, string | number | null | undefined> = {}
): Record<string, string | null | undefined> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      value === null || value === undefined ? value : String(value)
    ])
  )
}

function isSameLocation(
  first: NativeLocationLike,
  second: NativeLocationLike
): boolean {
  return (
    first.pathname === second.pathname &&
    (first.search || "") === (second.search || "") &&
    (first.hash || "") === (second.hash || "")
  )
}

function getComponentProps(
  option: RoutePropsOption | undefined,
  route: RouteLocationNormalized
): Record<string, unknown> {
  if (option === true) {
    return {
      ...route.params
    }
  }

  if (typeof option === "function") {
    return option(route)
  }

  return option || {}
}

function RouteComponentRenderer({
  component: Component,
  routeProps
}: {
  component:
    | ComponentType<any>
    | LazyExoticComponent<ComponentType<any>>
  routeProps?: RoutePropsOption
}) {
  const route = useCurrentRoute()

  return createElement(
    Component,
    getComponentProps(routeProps, route)
  )
}

function RouteRedirectRenderer({
  redirect
}: {
  redirect: NonNullable<AppRouteRecordRaw["redirect"]>
}) {
  const router = useRouterController()
  const route = useCurrentRoute()
  const target =
    typeof redirect === "function" ? redirect(route) : redirect
  const resolved = router.resolve(target)

  return createElement(Navigate, {
    to: resolved.fullPath,
    replace: true,
    state: resolved.state
  })
}

function convertRoutes(
  routes: AppRouteRecordRaw[],
  definitionMap: WeakMap<AppRouteRecordRaw, RouteDefinition>
): RouteObject[] {
  return routes.map((record) => {
    const definition = definitionMap.get(record)

    if (!definition) {
      throw new Error("路由定义转换失败")
    }

    let element = record.element

    if (record.redirect) {
      element = createElement(RouteRedirectRenderer, {
        redirect: record.redirect
      })
    } else if (record.component) {
      element = createElement(RouteComponentRenderer, {
        component: record.component,
        routeProps: record.props
      })
    } else if (element === undefined) {
      element = createElement(Outlet)
    }

    const handle: InternalRouteHandle = {
      __appRouter: definition
    }

    return {
      id: definition.id,
      path: record.path,
      index: record.index,
      caseSensitive: record.caseSensitive,
      element,
      errorElement: record.errorElement,
      loader: record.loader,
      action: record.action,
      shouldRevalidate: record.shouldRevalidate,
      handle,
      children: record.children
        ? convertRoutes(record.children, definitionMap)
        : undefined
    } as RouteObject
  })
}

function isInternalRouteHandle(
  handle: unknown
): handle is InternalRouteHandle {
  return Boolean(
    handle &&
      typeof handle === "object" &&
      "__appRouter" in handle
  )
}

async function invokeGuard(
  guard: NavigationGuard,
  to: RouteLocationNormalized,
  from: RouteLocationNormalized
): Promise<NavigationGuardReturn> {
  if (guard.length < 3) {
    return guard(to, from, () => undefined)
  }

  return new Promise<NavigationGuardReturn>((resolve, reject) => {
    let settled = false

    const settle = (value?: NavigationGuardReturn) => {
      if (settled) {
        return
      }

      settled = true
      resolve(value)
    }

    try {
      const result = guard(to, from, settle)

      Promise.resolve(result).then((value) => {
        if (value !== undefined) {
          settle(value)
        }
      }, reject)
    } catch (error) {
      reject(error)
    }
  })
}

function toGuardOutcome(
  result: NavigationGuardReturn
): GuardOutcome {
  if (result === false) {
    return {
      type: "abort"
    }
  }

  if (typeof result === "string") {
    return {
      type: "redirect",
      to: result
    }
  }

  if (result && typeof result === "object") {
    return {
      type: "redirect",
      to: result
    }
  }

  return {
    type: "allow"
  }
}

export class RouterController implements AppRouter {
  readonly routes: AppRouteRecordRaw[]
  readonly nativeRouter: ReactDataRouter

  private readonly routeObjects: RouteObject[]
  private readonly nameMap: Map<string, RouteDefinition>
  private readonly history: CreateRouterOptions["history"]
  private readonly beforeGuards = new Set<NavigationGuard>()
  private readonly resolveGuards = new Set<NavigationGuard>()
  private readonly afterHooks = new Set<AfterNavigationHook>()
  private readonly errorHandlers = new Set<RouterErrorHandler>()
  private currentRouteValue: RouteLocationNormalized
  private initializationPromise?: Promise<void>
  private ready = false
  private resolveReady!: () => void
  private readonly readyPromise: Promise<void>

  constructor(options: CreateRouterOptions) {
    this.routes = options.routes
    this.history = options.history

    const { definitionMap, nameMap } = createDefinitions(options.routes)

    this.nameMap = nameMap
    this.routeObjects = convertRoutes(options.routes, definitionMap)
    this.readyPromise = new Promise<void>((resolve) => {
      this.resolveReady = resolve
    })

    const rootRoute: RouteObject = {
      id: "__app-router-root__",
      element: createElement(RouterRuntime, {
        router: this
      }),
      children: this.routeObjects
    }
    const dataRoutes = [rootRoute]
    const basename = options.history.basename

    if (options.history.type === "hash") {
      this.nativeRouter = createHashRouter(dataRoutes, {
        basename
      })
    } else if (options.history.type === "memory") {
      this.nativeRouter = createMemoryRouter(dataRoutes, {
        basename,
        initialEntries: options.history.initialEntries,
        initialIndex: options.history.initialIndex
      }) as ReactDataRouter
    } else {
      this.nativeRouter = createBrowserRouter(dataRoutes, {
        basename
      })
    }

    this.currentRouteValue = this.normalizeNativeLocation(
      this.nativeRouter.state.location
    )
  }

  get currentRoute(): RouteLocationNormalized {
    return this.currentRouteValue
  }

  push(to: RouteLocationRaw): Promise<void> {
    const target = this.resolve(to)

    return this.nativeRouter.navigate(target.fullPath, {
      state: target.state
    })
  }

  replace(to: RouteLocationRaw): Promise<void> {
    const target = this.resolve(to)

    return this.nativeRouter.navigate(target.fullPath, {
      replace: true,
      state: target.state
    })
  }

  go(delta: number): Promise<void> {
    return this.nativeRouter.navigate(delta)
  }

  back(): Promise<void> {
    return this.go(-1)
  }

  forward(): Promise<void> {
    return this.go(1)
  }

  resolve(to: RouteLocationRaw): RouteLocationNormalized {
    const current = this.currentRouteValue || START_LOCATION

    if (typeof to === "string") {
      const base = `http://app-router.local${current.fullPath || "/"}`
      const url = new URL(to, base)

      return this.normalizeResolvedLocation({
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        state: null
      })
    }

    let pathname: string

    if (to.name) {
      const definition = this.nameMap.get(to.name)

      if (!definition) {
        throw new Error(`未找到名称为 ${to.name} 的路由`)
      }

      pathname = generatePath(
        definition.fullPath,
        normalizeParams(to.params)
      )
    } else {
      const rawPath = to.path || current.path || "/"
      pathname = to.params
        ? generatePath(rawPath, normalizeParams(to.params))
        : rawPath
    }

    const preserveCurrentQuery = !to.name && !to.path && !to.query
    const search = to.query
      ? stringifyQuery(to.query)
      : preserveCurrentQuery
        ? stringifyQuery(current.query)
        : ""
    const hash =
      to.hash !== undefined
        ? normalizeHash(to.hash)
        : !to.name && !to.path
          ? current.hash
          : ""

    return this.normalizeResolvedLocation({
      pathname,
      search,
      hash,
      state: to.state
    })
  }

  beforeEach(guard: NavigationGuard): () => void {
    this.beforeGuards.add(guard)

    return () => {
      this.beforeGuards.delete(guard)
    }
  }

  beforeResolve(guard: NavigationGuard): () => void {
    this.resolveGuards.add(guard)

    return () => {
      this.resolveGuards.delete(guard)
    }
  }

  afterEach(hook: AfterNavigationHook): () => void {
    this.afterHooks.add(hook)

    return () => {
      this.afterHooks.delete(hook)
    }
  }

  onError(handler: RouterErrorHandler): () => void {
    this.errorHandlers.add(handler)

    return () => {
      this.errorHandlers.delete(handler)
    }
  }

  isReady(): Promise<void> {
    return this.readyPromise
  }

  hasBeforeGuards(): boolean {
    return (
      this.beforeGuards.size > 0 ||
      this.resolveGuards.size > 0 ||
      this.hasRouteBeforeEnter()
    )
  }

  normalizeNativeLocation(
    location: NativeLocationLike
  ): RouteLocationNormalized {
    const basename = this.history.basename
    let pathname = location.pathname || "/"
    let matches = matchRoutes(
      this.routeObjects,
      {
        pathname,
        search: location.search || "",
        hash: location.hash || ""
      },
      basename
    )

    if (matches && basename !== "/") {
      pathname = pathname.slice(basename.length) || "/"
    } else if (!matches) {
      matches = matchRoutes(this.routeObjects, {
        pathname,
        search: location.search || "",
        hash: location.hash || ""
      })
    }

    return this.createNormalizedLocation(
      pathname,
      location.search || "",
      location.hash || "",
      location.state,
      matches
    )
  }

  setCurrentRoute(route: RouteLocationNormalized): void {
    this.currentRouteValue = route
  }

  async runBeforeGuards(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ): Promise<GuardOutcome> {
    const globalOutcome = await this.runGuardQueue(
      [...this.beforeGuards],
      to,
      from
    )

    if (globalOutcome.type !== "allow") {
      return globalOutcome
    }

    const fromIds = new Set(from.matched.map((item) => item.id))
    const routeGuards = to.matched.flatMap((item) => {
      if (fromIds.has(item.id) || !item.record.beforeEnter) {
        return []
      }

      return Array.isArray(item.record.beforeEnter)
        ? item.record.beforeEnter
        : [item.record.beforeEnter]
    })
    const routeOutcome = await this.runGuardQueue(
      routeGuards,
      to,
      from
    )

    if (routeOutcome.type !== "allow") {
      return routeOutcome
    }

    return this.runGuardQueue([...this.resolveGuards], to, from)
  }

  async runAfterHooks(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    failure?: NavigationFailure
  ): Promise<void> {
    for (const hook of this.afterHooks) {
      try {
        await hook(to, from, failure)
      } catch (error) {
        this.emitError(error, to, from)
      }
    }
  }

  emitError(
    error: unknown,
    to?: RouteLocationNormalized,
    from?: RouteLocationNormalized
  ): void {
    if (this.errorHandlers.size === 0) {
      console.error(error)
      return
    }

    this.errorHandlers.forEach((handler) => {
      handler(error, to, from)
    })
  }

  initialize(location: Location): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.runInitialNavigation(location)

    return this.initializationPromise
  }

  isInitialized(): boolean {
    return this.ready
  }

  private normalizeResolvedLocation(
    location: NativeLocationLike
  ): RouteLocationNormalized {
    const matches = matchRoutes(this.routeObjects, {
      pathname: location.pathname,
      search: location.search || "",
      hash: location.hash || ""
    })

    return this.createNormalizedLocation(
      location.pathname,
      location.search || "",
      location.hash || "",
      location.state,
      matches
    )
  }

  private createNormalizedLocation(
    pathname: string,
    search: string,
    hash: string,
    state: unknown,
    matches: RouteMatch<string, RouteObject>[] | null
  ): RouteLocationNormalized {
    const matched: RouteLocationMatched[] = []
    const meta: Record<string, unknown> = {}
    let name: string | undefined
    let params: Readonly<Params<string>> = {}

    matches?.forEach((match) => {
      const handle = match.route.handle

      if (!isInternalRouteHandle(handle)) {
        return
      }

      const definition = handle.__appRouter
      const routeMeta = definition.record.meta || {}

      Object.assign(meta, routeMeta)
      params = match.params

      if (definition.record.name) {
        name = definition.record.name
      }

      matched.push({
        id: definition.id,
        name: definition.record.name,
        path: definition.fullPath,
        meta: routeMeta,
        record: definition.record
      })
    })

    return {
      fullPath: `${pathname}${search}${hash}`,
      path: pathname,
      name,
      params,
      query: parseQuery(search),
      hash,
      state,
      meta,
      matched
    }
  }

  private async runGuardQueue(
    guards: NavigationGuard[],
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ): Promise<GuardOutcome> {
    for (const guard of guards) {
      const result = await invokeGuard(guard, to, from)
      const outcome = toGuardOutcome(result)

      if (outcome.type !== "allow") {
        return outcome
      }
    }

    return {
      type: "allow"
    }
  }

  private hasRouteBeforeEnter(): boolean {
    const walk = (routes: AppRouteRecordRaw[]): boolean => {
      return routes.some((route) => {
        return Boolean(
          route.beforeEnter ||
            (route.children && walk(route.children))
        )
      })
    }

    return walk(this.routes)
  }

  private async runInitialNavigation(location: Location): Promise<void> {
    const from = START_LOCATION
    const initialTarget = this.normalizeNativeLocation(location)
    let target = initialTarget

    try {
      for (let redirectCount = 0; redirectCount < 20; redirectCount += 1) {
        const outcome = await this.runBeforeGuards(target, from)

        if (outcome.type === "abort") {
          this.currentRouteValue = initialTarget
          await this.runAfterHooks(initialTarget, from, {
            type: "aborted"
          })
          return
        }

        if (outcome.type === "redirect") {
          target = this.resolve(outcome.to)
          continue
        }

        if (target.fullPath !== initialTarget.fullPath) {
          await this.nativeRouter.navigate(target.fullPath, {
            replace: true,
            state: target.state
          })
        }

        this.currentRouteValue = target
        await this.runAfterHooks(target, from)
        return
      }

      throw new Error("路由守卫重定向次数超过 20 次")
    } catch (error) {
      this.currentRouteValue = initialTarget
      this.emitError(error, initialTarget, from)
      await this.runAfterHooks(initialTarget, from, {
        type: "error",
        error
      })
    } finally {
      this.ready = true
      this.resolveReady()
    }
  }
}

function RouterRuntime({ router }: { router: RouterController }) {
  const location = useLocation()
  const [ready, setReady] = useState(router.isInitialized())
  const currentRouteRef = useRef(router.currentRoute)
  const guardRunIdRef = useRef(0)
  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation
    }: {
      currentLocation: Location
      nextLocation: Location
    }) => {
      return (
        ready &&
        router.hasBeforeGuards() &&
        !isSameLocation(currentLocation, nextLocation)
      )
    },
    [ready, router]
  )
  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    let active = true

    router.initialize(location).then(() => {
      if (!active) {
        return
      }

      currentRouteRef.current = router.currentRoute
      setReady(true)
    })

    return () => {
      active = false
    }
  }, [location, router])

  useEffect(() => {
    if (!ready || blocker.state !== "blocked") {
      return
    }

    const runId = ++guardRunIdRef.current
    const from = currentRouteRef.current
    const to = router.normalizeNativeLocation(blocker.location)

    router
      .runBeforeGuards(to, from)
      .then((outcome) => {
        if (
          runId !== guardRunIdRef.current ||
          blocker.state !== "blocked"
        ) {
          return
        }

        if (outcome.type === "allow") {
          blocker.proceed()
          return
        }

        blocker.reset()

        if (outcome.type === "abort") {
          void router.runAfterHooks(to, from, {
            type: "aborted"
          })
          return
        }

        window.setTimeout(() => {
          void router.push(outcome.to)
        }, 0)
      })
      .catch((error) => {
        if (runId !== guardRunIdRef.current) {
          return
        }

        blocker.reset()
        router.emitError(error, to, from)
        void router.runAfterHooks(to, from, {
          type: "error",
          error
        })
      })
  }, [blocker, ready, router])

  useEffect(() => {
    if (!ready) {
      return
    }

    const to = router.normalizeNativeLocation(location)
    const from = currentRouteRef.current

    if (to.fullPath === from.fullPath && to.state === from.state) {
      return
    }

    currentRouteRef.current = to
    router.setCurrentRoute(to)
    void router.runAfterHooks(to, from)
  }, [location, ready, router])

  return ready ? createElement(Outlet) : null
}

export function createRouter(
  options: CreateRouterOptions
): RouterController {
  return new RouterController(options)
}
