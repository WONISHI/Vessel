import type { ComponentType, LazyExoticComponent, ReactNode } from "react"
import type { ActionFunction, LoaderFunction, Params, ShouldRevalidateFunction } from "react-router-dom"

/**
 * 表示一个值既可以同步返回，也可以通过 Promise 异步返回。
 */
export type Awaitable<T> = T | Promise<T>

/**
 * 路由元信息。
 *
 * 可以保存页面标题、权限标识、菜单状态等自定义数据。
 *
 * @example
 * {
 *   title: "编辑器",
 *   requiresWorkspace: true,
 *   hidden: false
 * }
 */
export type RouteMeta = Record<string, unknown>

/**
 * 单个路由查询参数允许使用的值类型。
 *
 * undefined 类型的值不会写入 URL。
 * null 类型的值会被转换为空字符串。
 */
export type RouteQueryValue = string | number | boolean | null | undefined

/**
 * 路由查询参数对象。
 *
 * 数组类型会生成多个同名查询参数。
 *
 * @example
 * {
 *   keyword: "Vessel",
 *   page: 1,
 *   tags: ["react", "router"]
 * }
 */
export type RouteQuery = Record<string, RouteQueryValue | RouteQueryValue[]>

/**
 * 对象形式的路由地址。
 *
 * 支持通过路由名称或路径进行跳转。
 *
 * @example
 * {
 *   name: "user-detail",
 *   params: {
 *     id: 1001
 *   },
 *   query: {
 *     tab: "profile"
 *   },
 *   hash: "detail"
 * }
 */
export interface RouteLocationObject {
  /**
   * 目标路由名称。
   *
   * 设置 name 后会根据路由配置查找对应路径。
   */
  name?: string

  /**
   * 目标路由路径。
   *
   * name 和 path 通常选择其中一个使用。
   */
  path?: string

  /**
   * 动态路由参数。
   *
   * @example
   * 路由路径为 /users/:id 时：
   * {
   *   id: 1001
   * }
   */
  params?: Record<string, string | number | null | undefined>

  /**
   * URL 查询参数。
   */
  query?: RouteQuery

  /**
   * URL Hash。
   *
   * 可以传入 detail 或 #detail。
   */
  hash?: string

  /**
   * 写入浏览器 History 的自定义状态。
   *
   * 不会显示在 URL 中。
   */
  state?: unknown
}

/**
 * 路由跳转目标。
 *
 * 既支持字符串路径，也支持对象形式。
 *
 * @example
 * router.push("/editor")
 *
 * @example
 * router.push({
 *   name: "editor"
 * })
 */
export type RouteLocationRaw = string | RouteLocationObject

/**
 * 当前地址匹配到的单条路由记录。
 *
 * 嵌套路由会产生多条匹配记录。
 */
export interface RouteLocationMatched {
  /**
   * 路由唯一 ID。
   *
   * 未主动设置时由路由封装内部生成。
   */
  id: string

  /**
   * 路由名称。
   */
  name?: string

  /**
   * 包含父级路径的完整路由路径模板。
   */
  path: string

  /**
   * 当前路由记录自身的 meta。
   *
   * 不包含父级路由合并后的 meta。
   */
  meta: RouteMeta

  /**
   * 原始路由配置。
   */
  record: AppRouteRecordRaw
}

/**
 * 标准化后的路由地址。
 *
 * 用于 useRoute、全局守卫、路由独享守卫和后置钩子。
 */
export interface RouteLocationNormalized {
  /**
   * 完整地址。
   *
   * 由 path、query 和 hash 组成。
   *
   * @example
   * /users/1001?tab=profile#detail
   */
  fullPath: string

  /**
   * 不包含 query 和 hash 的路由路径。
   *
   * @example
   * /users/1001
   */
  path: string

  /**
   * 当前匹配到的路由名称。
   */
  name?: string

  /**
   * 从动态路径中解析出的路由参数。
   */
  params: Readonly<Params<string>>

  /**
   * 从 URL 中解析出的查询参数。
   *
   * 同名参数出现多次时，对应值为字符串数组。
   */
  query: Record<string, string | string[]>

  /**
   * 当前 URL Hash。
   *
   * 存在时包含 # 前缀。
   */
  hash: string

  /**
   * 当前 History State。
   */
  state: unknown

  /**
   * 从父路由到子路由合并后的 meta。
   *
   * 子路由的同名字段会覆盖父路由。
   */
  meta: RouteMeta

  /**
   * 当前地址匹配到的全部路由记录。
   *
   * 顺序为父路由到子路由。
   */
  matched: RouteLocationMatched[]
}

/**
 * 路由守卫允许返回的结果。
 *
 * - undefined：继续导航
 * - true：继续导航
 * - false：取消导航
 * - string：重定向到指定路径
 * - RouteLocationObject：通过对象方式重定向
 */
export type NavigationGuardReturn = void | true | false | RouteLocationRaw

/**
 * next 风格的路由守卫回调。
 *
 * 推荐优先使用 return 写法。
 */
export type NavigationGuardNext = (result?: NavigationGuardReturn) => void

/**
 * 路由守卫。
 *
 * 同时支持 return 和 next 两种写法，但同一个守卫中不要混用。
 *
 * @example
 * router.beforeEach((to) => {
 *   if (to.meta.requiresAuth) {
 *     return {
 *       name: "login"
 *     }
 *   }
 * })
 *
 * @example
 * router.beforeEach((to, from, next) => {
 *   if (to.meta.requiresAuth) {
 *     next({
 *       name: "login"
 *     })
 *     return
 *   }
 *
 *   next()
 * })
 */
export type NavigationGuard = (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => Awaitable<NavigationGuardReturn>

/**
 * 导航失败信息。
 */
export interface NavigationFailure {
  /**
   * 导航失败类型。
   *
   * - aborted：导航被守卫取消
   * - error：导航过程中发生异常
   */
  type: "aborted" | "error"

  /**
   * 导航过程中捕获到的原始异常。
   */
  error?: unknown
}

/**
 * 全局后置导航钩子。
 *
 * 导航成功、取消或发生异常后执行。
 */
export type AfterNavigationHook = (to: RouteLocationNormalized, from: RouteLocationNormalized, failure?: NavigationFailure) => Awaitable<void>

/**
 * 路由异常处理器。
 */
export type RouterErrorHandler = (error: unknown, to?: RouteLocationNormalized, from?: RouteLocationNormalized) => void

/**
 * 路由组件 Props 配置。
 *
 * - false：不传递路由参数
 * - true：将 route.params 作为组件 Props
 * - object：将固定对象作为组件 Props
 * - function：根据当前路由生成组件 Props
 */
export type RoutePropsOption = boolean | Record<string, unknown> | ((route: RouteLocationNormalized) => Record<string, unknown>)

/**
 * 路由页面组件类型。
 *
 * 同时支持普通 React 组件和 React.lazy 创建的异步组件。
 */
export type RouteComponent = ComponentType<any> | LazyExoticComponent<ComponentType<any>>

/**
 * 原始路由配置。
 *
 * 使用方式接近 Vue Router 的 RouteRecordRaw。
 */
export interface AppRouteRecordRaw {
  /**
   * 路由唯一 ID。
   *
   * 未设置时会根据 name 或内部递增值自动生成。
   */
  id?: string

  /**
   * 路由路径。
   *
   * 子路由可以使用相对路径。
   */
  path?: string

  /**
   * 是否为默认子路由。
   *
   * index 路由不能同时设置 path 和 children。
   */
  index?: boolean

  /**
   * 路由名称。
   *
   * 用于对象方式跳转和解析路由，必须保持唯一。
   */
  name?: string

  /**
   * 路由页面组件。
   */
  component?: RouteComponent

  /**
   * 直接传递给 React Router 的 React 元素。
   *
   * component 和 element 通常选择其中一个。
   */
  element?: ReactNode

  /**
   * 嵌套路由。
   *
   * 父路由组件需要使用 RouterView 渲染子路由。
   */
  children?: AppRouteRecordRaw[]

  /**
   * 路由重定向配置。
   *
   * 支持固定地址或根据当前路由动态计算目标地址。
   */
  redirect?: RouteLocationRaw | ((to: RouteLocationNormalized) => RouteLocationRaw)

  /**
   * 路由附加信息。
   *
   * 常用于页面标题、权限校验和菜单显示。
   */
  meta?: RouteMeta

  /**
   * 传递给路由组件的 Props。
   */
  props?: RoutePropsOption

  /**
   * 路由独享前置守卫。
   *
   * 支持单个守卫或多个守卫。
   */
  beforeEnter?: NavigationGuard | NavigationGuard[]

  /**
   * React Router 数据加载函数。
   */
  loader?: LoaderFunction

  /**
   * React Router数据提交函数。
   */
  action?: ActionFunction

  /**
   * 控制当前路由是否重新执行 loader。
   */
  shouldRevalidate?: ShouldRevalidateFunction

  /**
   * loader、action 或渲染发生异常时显示的内容。
   */
  errorElement?: ReactNode

  /**
   * 路径匹配时是否区分大小写。
   */
  caseSensitive?: boolean
}

/**
 * 路由 History 配置。
 */
export interface RouterHistory {
  /**
   * History 类型。
   *
   * - browser：基于浏览器 History API
   * - hash：基于 URL Hash，适合 Electron
   * - memory：基于内存，适合测试或非浏览器环境
   */
  type: "browser" | "hash" | "memory"

  /**
   * 路由基础路径。
   */
  basename: string

  /**
   * Memory History 的初始地址列表。
   */
  initialEntries?: string[]

  /**
   * Memory History 的初始地址索引。
   */
  initialIndex?: number
}

/**
 * createRouter 配置。
 */
export interface CreateRouterOptions {
  /**
   * 路由 History 配置。
   */
  history: RouterHistory

  /**
   * 路由配置表。
   */
  routes: AppRouteRecordRaw[]
}

/**
 * RouterProvider 组件 Props。
 */
export interface RouterProviderProps {
  /**
   * createRouter 创建的路由实例。
   */
  router: AppRouter
}

/**
 * RouterView 组件 Props。
 */
export interface RouterViewProps {
  /**
   * 传递给子路由的 Outlet Context。
   *
   * 子路由可以通过 useOutletContext 获取。
   */
  context?: unknown
}

/**
 * 路由守卫允许导航。
 */
export interface GuardOutcomeAllow {
  type: "allow"
}

/**
 * 路由守卫取消导航。
 */
export interface GuardOutcomeAbort {
  type: "abort"
}

/**
 * 路由守卫重定向导航。
 */
export interface GuardOutcomeRedirect {
  type: "redirect"

  /**
   * 重定向目标。
   */
  to: RouteLocationRaw
}

/**
 * 路由守卫执行结果。
 *
 * 仅供路由封装内部使用。
 */
export type GuardOutcome = GuardOutcomeAllow | GuardOutcomeAbort | GuardOutcomeRedirect

/**
 * 路由实例对外 API。
 */
export interface AppRouter {
  /**
   * 当前标准化路由。
   *
   * React 组件中需要响应路由更新时，建议使用 useRoute。
   */
  readonly currentRoute: RouteLocationNormalized

  /**
   * 原始路由配置表。
   */
  readonly routes: AppRouteRecordRaw[]

  /**
   * 新增一条 History 记录并跳转。
   */
  push(to: RouteLocationRaw): Promise<void>

  /**
   * 替换当前 History 记录并跳转。
   */
  replace(to: RouteLocationRaw): Promise<void>

  /**
   * 根据偏移量切换 History 记录。
   */
  go(delta: number): Promise<void>

  /**
   * 返回上一条 History 记录。
   */
  back(): Promise<void>

  /**
   * 前往下一条 History 记录。
   */
  forward(): Promise<void>

  /**
   * 将字符串或对象路由解析为标准化路由。
   */
  resolve(to: RouteLocationRaw): RouteLocationNormalized

  /**
   * 注册全局前置守卫。
   *
   * 返回值用于注销当前守卫。
   */
  beforeEach(guard: NavigationGuard): () => void

  /**
   * 注册全局解析守卫。
   *
   * 在全局前置守卫和路由独享守卫通过后执行。
   */
  beforeResolve(guard: NavigationGuard): () => void

  /**
   * 注册全局后置钩子。
   *
   * 返回值用于注销当前钩子。
   */
  afterEach(hook: AfterNavigationHook): () => void

  /**
   * 注册路由异常处理器。
   *
   * 返回值用于注销当前处理器。
   */
  onError(handler: RouterErrorHandler): () => void

  /**
   * 等待首次路由导航和守卫执行完成。
   */
  isReady(): Promise<void>
}
